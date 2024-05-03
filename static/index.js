import DEFAULT from "./default.js";

const dialog = document.querySelector("dialog");

function getNode(x, y) {
	return document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
}

function initSocket(ws) {
	ws.onmessage = e => {
		let data = JSON.parse(e.data);
		let [x, y] = data.key;
		let node = getNode(x, y);
		if (!node) { return; }
		node.textContent = data.value;
	}
	window.ws = ws;
}

function initPicker(picker, ws) {
	picker.addEventListener("emoji-click", e => {
		let x = Number(dialog.dataset.x);
		let y = Number(dialog.dataset.y);
		let node = getNode(x, y);
		if (node) {
			let msg = {
				key: [x, y],
				value: e.detail.unicode
			}
			node.textContent = msg.value;
			ws.send(JSON.stringify(msg));
		}
		dialog.close();
	});
}

function init() {
	let size = 0;
	let main = document.querySelector("main");
	let picker = document.querySelector("emoji-picker");

	DEFAULT.trim().split("\n").forEach((row, y) => {
		[...row].forEach((ch, x) => {
			let node = document.createElement("b");
			size = Math.max(size, x);
			node.dataset.x = x;
			node.dataset.y = y;
			node.textContent = ch;
			main.append(node);
		});
	});

	main.style.setProperty("--size", size+1);
	main.addEventListener("click", e => {
		let target = e.target;
		if (target.dataset.x) {
			dialog.dataset.x = target.dataset.x;
			dialog.dataset.y = target.dataset.y;
			dialog.showModal();
		}
	})

	let url = `${location.protocol == "https:" ? "wss:" : "ws:"}//${location.host}`;
	let ws = new WebSocket(url);
	initSocket(ws);
	initPicker(picker, ws);

	document.body.addEventListener("click", e => {
		if (e.target == dialog) { dialog.close(); }
	})
}

init();
