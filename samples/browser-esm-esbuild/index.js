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

// --- Function to recompute wrapper position + size ---
function updateWrapper() {
	const model = editor.getModel();
	if (!model) return;

	const lineCount = model.getLineCount();

	const startPos = new monaco.Position(1, 1);
	const endPos = new monaco.Position(lineCount, model.getLineMaxColumn(lineCount));

	const startCoords = editor.getScrolledVisiblePosition(startPos);
	const endCoords = editor.getScrolledVisiblePosition(endPos);

	if (!startCoords || !endCoords) return;

	const contentWidth = editor.getLayoutInfo().contentWidth;
	const top = startCoords.top;
	const height = endCoords.top + endCoords.height - startCoords.top;

	rockRect.style.top = `${top}px`;
	rockRect.style.left = `${startCoords.left}px`;
	rockRect.style.width = `${contentWidth - 20}px`;
	rockRect.style.height = `${height}px`;
}

// --- Hook into editor events ---
editor.onDidScrollChange(updateWrapper);
editor.onDidLayoutChange(updateWrapper);
editor.onDidChangeModelContent(updateWrapper);

// --- Initial render ---
updateWrapper();

// --- Keep track of all active zones ---
let rockZoneIds = [];

// --- Function to insert ViewZones between lines ---
function addRockZones() {
	const model = editor.getModel();
	if (!model) return;

	const lineCount = model.getLineCount();

	editor.changeViewZones((accessor) => {
		// Step 1: Remove all existing zones
		for (const id of rockZoneIds) {
			accessor.removeZone(id);
		}
		rockZoneIds = [];

		// Step 2: Add one rock zone after each line
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
}

// --- Initial render ---
addRockZones();

// --- Re-render dynamically on edits and layout changes ---
editor.onDidChangeModelContent(() => {
	requestAnimationFrame(() => addRockZones());
});
editor.onDidLayoutChange(() => addRockZones());

// --- Rock decorations (after every token) - Using model.deltaDecorations ---
let rockDecorationIds = [];

function addRocksAfterTokens() {
	const model = editor.getModel();
	if (!model) return;

	console.log('Adding rocks after tokens...');

	const newDecorations = [];
	const lineCount = model.getLineCount();

	for (let line = 1; line <= lineCount; line++) {
		const content = model.getLineContent(line);

		console.log(`Line ${line}: "${content}"`);

		const tokens = monaco.editor.tokenize(content, model.getLanguageId())[0];

		console.log(`  Tokens:`, tokens);

		if (!tokens || tokens.length === 0) continue;

		for (let i = 0; i < tokens.length; i++) {
			const startCol = tokens[i].offset + 1;
			const endCol = i + 1 < tokens.length ? tokens[i + 1].offset + 1 : content.length + 1;

			console.log(`  Token ${i}: cols ${startCol}-${endCol}, type: ${tokens[i].type}`);

			// Add decoration after each token using inlineClassName
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

	console.log(`Total decorations to add: ${newDecorations.length}`);

	// Use model.deltaDecorations instead of editor method
	rockDecorationIds = model.deltaDecorations(rockDecorationIds, newDecorations);

	console.log('Decorations applied!', rockDecorationIds);
}

// Trigger initial render
setTimeout(() => {
	addRocksAfterTokens();
}, 500);

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
