import * as monaco from 'monaco-editor';
// import * as monaco from '../src';
import './index.css';
import { LayoutTree } from '../../src/layout-tree';
import layout, { RenderSettings } from '../../demo/layout';
import * as rb from '../../src/';
import { OutlinedRocksLayoutSettings, RocksLayoutSettings } from '../../src/rocks-layout/layout';
import { measureLayoutTree } from '../../src/layout-tree';

// @ts-ignore
self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.bundle.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.bundle.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.bundle.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.bundle.js';
		}
		return './editor.worker.bundle.js';
	}
};

// const editor = monaco.editor.create(document.body, {
// 	value: ['function x() {', '\tconsole.log("Hello world!");', '}'].join('\n'),
// 	language: 'typescript'
// });

const editor = monaco.editor.create(document.body, {
	value: ['def add(x, y):', '\treturn x + y'].join('\n'),
	language: 'python'
});

// Step 1: Create the overlay DOM node
// const rockRect = document.createElement('div');
// rockRect.style.position = 'absolute';
// rockRect.style.background = 'rgba(255, 255, 0, 0.2)';
// rockRect.style.border = '2px solid gold';
// rockRect.style.borderRadius = '4px';
// rockRect.style.pointerEvents = 'none';

// // Step 2: Add overlay widget
// const rockOverlay = {
// 	getId: () => 'rock.dynamic.overlay',
// 	getDomNode: () => rockRect,
// 	getPosition: () => null
// };
// editor.addOverlayWidget(rockOverlay);

// // --- Keep track of all active zones ---
// let rockZoneIds = [];
// let rockDecorationIds = [];

// // --- Combined update function for all three rock components ---
// function updateAllRocks() {
// 	const model = editor.getModel();
// 	if (!model) return;

// 	const lineCount = model.getLineCount();

// 	// 1. Update wrapper overlay (yellow box)
// 	const startPos = new monaco.Position(1, 1);
// 	const endPos = new monaco.Position(lineCount, model.getLineMaxColumn(lineCount));

// 	const startCoords = editor.getScrolledVisiblePosition(startPos);
// 	const endCoords = editor.getScrolledVisiblePosition(endPos);

// 	if (startCoords && endCoords) {
// 		const contentWidth = editor.getLayoutInfo().contentWidth;
// 		const top = startCoords.top;
// 		const height = endCoords.top + endCoords.height - startCoords.top;

// 		rockRect.style.top = `${top}px`;
// 		rockRect.style.left = `${startCoords.left}px`;
// 		rockRect.style.width = `${contentWidth - 20}px`;
// 		rockRect.style.height = `${height}px`;
// 	}

// 	// 2. Update ViewZones (rocks between lines)
// 	editor.changeViewZones((accessor) => {
// 		// Remove all existing zones
// 		for (const id of rockZoneIds) {
// 			accessor.removeZone(id);
// 		}
// 		rockZoneIds = [];

// 		// Add one rock zone after each line
// 		for (let line = 1; line <= lineCount; line++) {
// 			const domNode = document.createElement('div');
// 			domNode.textContent = '🪨';
// 			domNode.style.textAlign = 'center';
// 			domNode.style.lineHeight = '20px';
// 			domNode.style.fontSize = '16px';
// 			domNode.style.color = 'goldenrod';
// 			domNode.style.userSelect = 'none';
// 			domNode.style.pointerEvents = 'none';

// 			const id = accessor.addZone({
// 				afterLineNumber: line,
// 				heightInPx: 20,
// 				domNode
// 			});

// 			rockZoneIds.push(id);
// 		}
// 	});

// 	// 3. Update token decorations (rocks between tokens)
// 	const newDecorations = [];

// 	for (let line = 1; line <= lineCount; line++) {
// 		const content = model.getLineContent(line);
// 		const tokens = monaco.editor.tokenize(content, model.getLanguageId())[0];

// 		if (!tokens || tokens.length === 0) continue;

// 		for (let i = 0; i < tokens.length; i++) {
// 			const endCol = i + 1 < tokens.length ? tokens[i + 1].offset + 1 : content.length + 1;

// 			newDecorations.push({
// 				range: new monaco.Range(line, endCol, line, endCol),
// 				options: {
// 					beforeContentClassName: 'rock-decoration',
// 					before: {
// 						content: '🪨'
// 					}
// 				}
// 			});
// 		}
// 	}

// 	// Apply decorations
// 	rockDecorationIds = model.deltaDecorations(rockDecorationIds, newDecorations);
// }

// // --- Hook into editor events ---
// editor.onDidScrollChange(updateAllRocks);
// editor.onDidLayoutChange(updateAllRocks);
// editor.onDidChangeModelContent(() => {
// 	requestAnimationFrame(updateAllRocks);
// });

// // --- Initial render ---
// setTimeout(() => {
// 	updateAllRocks();
// }, 100);

// // --- Style for rock glyphs ---
// const style = document.createElement('style');
// style.textContent = `
// 	.monaco-editor .rock-decoration::before {
// 		content: '🪨';
// 		margin-left: 6px;
// 		margin-right: 6px;
// 		font-size: 16px;
// 		color: goldenrod;
// 		user-select: none;
// 		pointer-events: none;
// 	}
// `;
// document.head.appendChild(style);

// --- Make a fake LayoutTree for `def add(x, y): return x + y`
const tree: LayoutTree = {
	type: 'Node',
	padding: 4,
	children: [
		{ type: 'Atom', text: 'def' },
		{ type: 'Spacer', text: ' ' },
		{ type: 'Atom', text: 'add' },
		{ type: 'Atom', text: '(' },
		{ type: 'Atom', text: 'x' },
		{ type: 'Atom', text: ',' },
		{ type: 'Spacer', text: ' ' },
		{ type: 'Atom', text: 'y' },
		{ type: 'Atom', text: ')' },
		{ type: 'Atom', text: ':' },
		{ type: 'Newline' },
		{
			type: 'Node',
			padding: 2,
			children: [
				{ type: 'Atom', text: 'return' },
				{ type: 'Spacer', text: ' ' },
				{ type: 'Atom', text: 'x' },
				{ type: 'Spacer', text: ' ' },
				{ type: 'Atom', text: '+' },
				{ type: 'Spacer', text: ' ' },
				{ type: 'Atom', text: 'y' }
			]
		}
	]
};

rb.removePadding(tree);
rb.randomizeFillColors(tree);

// Step 1: Measure tree
const measured = measureLayoutTree(tree, (text) => {
	const width = text.length * 8;
	const height = 16;
	return { left: 0, top: 0, right: width, bottom: height };
});

// Step 2: Create algorithm and render settings
// const algoSettings = new RocksLayoutSettings(true, 10);
const algoSettings = new OutlinedRocksLayoutSettings(true, 10, true);

const renderSettings = <RenderSettings>{
	renderDistanceMesh: false,
	renderFragmentBoundingBoxes: false
};

// Step 3: Run layout
layout(measured, 'L1S+', algoSettings, renderSettings, false)
	.then((result) => {
		if (result.status === 'done') {
			console.log('Layout duration:', result.duration, 'ms');
			const svgContainer = document.createElement('div');
			svgContainer.innerHTML = result.svgSrc;
			document.body.appendChild(svgContainer);
		} else {
			console.error('Layout failed:', result);
		}
	})
	.catch((err) => console.error('Layout error:', err));
