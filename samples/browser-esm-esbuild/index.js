import * as monaco from 'monaco-editor/esm/vs/editor/editor.main.js';

self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') return './vs/language/json/json.worker.js';
		if (label === 'css' || label === 'scss' || label === 'less')
			return './vs/language/css/css.worker.js';
		if (label === 'html' || label === 'handlebars' || label === 'razor')
			return './vs/language/html/html.worker.js';
		if (label === 'typescript' || label === 'javascript')
			return './vs/language/typescript/ts.worker.js';
		return './vs/editor/editor.worker.js';
	}
};

// Create the editor
const editor = monaco.editor.create(document.getElementById('container'), {
	value: ['function x() {', '\tconsole.log("Hello world!");', '}'].join('\n'),
	language: 'javascript',
	fontSize: 16
});

// Step 1: Create the overlay DOM node
const rockRect = document.createElement('div');
rockRect.style.position = 'absolute';
rockRect.style.background = 'rgba(255, 255, 0, 0.2)';
rockRect.style.border = '2px solid gold';
rockRect.style.borderRadius = '4px';
rockRect.style.pointerEvents = 'none';

// Step 2: Add overlay widget
const rockOverlay = {
	getId: () => 'rock.dynamic.overlay',
	getDomNode: () => rockRect,
	getPosition: () => null
};
editor.addOverlayWidget(rockOverlay);

// --- Keep track of all active zones ---
let rockZoneIds = [];
let rockDecorationIds = [];

// --- Combined update function for all three rock experiments ---
function updateAllRocks() {
	const model = editor.getModel();
	if (!model) return;

	const lineCount = model.getLineCount();

	// 1. Update wrapper overlay (yellow box)
	const startPos = new monaco.Position(1, 1);
	const endPos = new monaco.Position(lineCount, model.getLineMaxColumn(lineCount));

	const startCoords = editor.getScrolledVisiblePosition(startPos);
	const endCoords = editor.getScrolledVisiblePosition(endPos);

	if (startCoords && endCoords) {
		const contentWidth = editor.getLayoutInfo().contentWidth;
		const top = startCoords.top;
		const height = endCoords.top + endCoords.height - startCoords.top;

		rockRect.style.top = `${top}px`;
		rockRect.style.left = `${startCoords.left}px`;
		rockRect.style.width = `${contentWidth - 20}px`;
		rockRect.style.height = `${height}px`;
	}

	// 2. Update ViewZones (rocks between lines)
	editor.changeViewZones((accessor) => {
		// Remove all existing zones
		for (const id of rockZoneIds) {
			accessor.removeZone(id);
		}
		rockZoneIds = [];

		// Add one rock zone after each line
		for (let line = 1; line <= lineCount; line++) {
			const domNode = document.createElement('div');
			domNode.textContent = '🪨';
			domNode.style.textAlign = 'center';
			domNode.style.lineHeight = '20px';
			domNode.style.fontSize = '16px';
			domNode.style.color = 'goldenrod';
			domNode.style.userSelect = 'none';
			domNode.style.pointerEvents = 'none';

			const id = accessor.addZone({
				afterLineNumber: line,
				heightInPx: 20,
				domNode
			});

			rockZoneIds.push(id);
		}
	});

	// 3. Update token decorations (rocks between tokens)
	const newDecorations = [];

	for (let line = 1; line <= lineCount; line++) {
		const content = model.getLineContent(line);
		const tokens = monaco.editor.tokenize(content, model.getLanguageId())[0];

		if (!tokens || tokens.length === 0) continue;

		for (let i = 0; i < tokens.length; i++) {
			const endCol = i + 1 < tokens.length ? tokens[i + 1].offset + 1 : content.length + 1;

			newDecorations.push({
				range: new monaco.Range(line, endCol, line, endCol),
				options: {
					beforeContentClassName: 'rock-decoration',
					before: {
						content: '🪨'
					}
				}
			});
		}
	}

	// Apply decorations
	rockDecorationIds = model.deltaDecorations(rockDecorationIds, newDecorations);
}

// --- Hook into editor events ---
editor.onDidScrollChange(updateAllRocks);
editor.onDidLayoutChange(updateAllRocks);
editor.onDidChangeModelContent(() => {
	requestAnimationFrame(updateAllRocks);
});

// --- Initial render ---
setTimeout(() => {
	updateAllRocks();
}, 100);

// --- Style for rock glyphs ---
const style = document.createElement('style');
style.textContent = `
	.monaco-editor .rock-decoration::before {
		content: '🪨';
		margin-left: 6px;
		margin-right: 6px;
		font-size: 16px;
		color: goldenrod;
		user-select: none;
		pointer-events: none;
	}
`;
document.head.appendChild(style);
