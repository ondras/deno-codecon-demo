import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { serveFile } from "https://deno.land/std@0.192.0/http/file_server.ts"
import { posix, join } from "https://deno.land/std@0.192.0/path/mod.ts"

let clients = new Set<WebSocket>()
let data = new Map<string, string>()
let kv = await Deno.openKv()
let bc = new BroadcastChannel("")

bc.onmessage = e => {
	let msg = e.data;

	// local data cache
	data.set(msg.key.join(","), msg.value)

	// distribute to other sockets
	let str = JSON.stringify(msg)
	clients.forEach(client => client.send(str))
}

function onClientMessage(str: string, socket: WebSocket) {
	let msg = JSON.parse(str)  // fixme validate

	// write to KV + local data cache
	kv.set(msg.key, msg.value)
	data.set(msg.key.join(","), msg.value)

	// distribute to other sockets + other nodes
	clients.forEach(client => {
		if (client != socket) { client.send(str) }
	});
	bc.postMessage(msg)
}

function onClientOpen(socket: WebSocket) {
	for (let [skey, value] of data) {
		let key = skey.split(",").map(Number)
		let msg = {key, value}
		socket.send(JSON.stringify(msg))
	}
}

async function reset(url: URL) {
	for (let [skey, value] of data) {
		let key = skey.split(",").map(Number)
		await kv.delete(key)
	}
	data.clear()
	return Response.redirect(new URL("/", url))
}

async function handler(request: Request) {
	if (request.headers.get("upgrade") == "websocket") {
		const { socket, response } = Deno.upgradeWebSocket(request)
		clients.add(socket)
		socket.onclose = _ => clients.delete(socket)
		socket.onmessage = e => onClientMessage(e.data as string, socket)
		socket.onopen = _ => onClientOpen(socket)
		return response
	} else {
		const url = new URL(request.url)
		let path = decodeURIComponent(url.pathname)
		if (path == "/reset") { return reset(url) }
		if (path == "/") { path = "/index.html" }
		path = join("./static", posix.normalize(path))
		return serveFile(request, path)
	}
}

let initialData = kv.list<string>({prefix:[]})
for await (let item of initialData) {
	data.set(item.key.join(","), item.value)
}

serve(handler)