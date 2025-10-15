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

// -- Rock Widget --
// --- Step 1: Create a DOM node for the overlay widget ---
// const widgetDom = document.createElement('div');
// widgetDom.textContent = '🪨 Overlay Widget Active';
// widgetDom.style.background = 'rgba(255, 255, 0, 0.2)';
// widgetDom.style.padding = '4px 8px';
// widgetDom.style.border = '1px solid gold';
// widgetDom.style.borderRadius = '4px';
// widgetDom.style.fontFamily = 'monospace';

// --- Step 2: Define the widget object ---
// const rockWidget = {
// 	getId: () => 'rock.overlay.widget',
// 	getDomNode: () => widgetDom,
// 	getPosition: () => ({
// 		preference: monaco.editor.OverlayWidgetPositionPreference.TOP_RIGHT
// 	})
// };

// --- Step 3: Register the widget with the editor ---
// editor.addOverlayWidget(rockWidget);

// Step 1: Create the overlay DOM node
const rockRect = document.createElement('div');
rockRect.style.position = 'absolute';
rockRect.style.border = '2px solid gold';
rockRect.style.borderRadius = '4px';
rockRect.style.pointerEvents = 'none'; // don't block text clicks

// Step 2: Add overlay widget
const rockOverlay = {
	getId: () => 'rock.dynamic.overlay',
	getDomNode: () => rockRect,
	getPosition: () => null // absolute positioning
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
