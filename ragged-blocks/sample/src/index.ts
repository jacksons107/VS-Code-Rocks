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

// // Step 1: Create the overlay DOM node
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

// ----- Layout Stuff -----

async function extractFragmentsFromLayout(
	measuredTree: rb.LayoutTree<rb.WithMeasurements>,
	algoName: any,
	algoSettings: rb.Settings<any>
) {
	const atomsIter = rb.eachAtomWithInheritedStyles(measuredTree);
	const algo = rb.constructAlgoByName(algoName, algoSettings);
	const layoutResult = await algo.layout(measuredTree);
	const fragments: {
		text: string;
		rect: rb.Rect;
		color?: string;
		atom?: rb.Atom<rb.WithMeasurements<rb.WithStyles>>;
	}[] = [];

	for (const frag of layoutResult.fragmentsInfo()) {
		const atom = atomsIter.next().value as rb.Atom<rb.WithMeasurements<rb.WithStyles>>;

		console.log(
			`${frag.text}: left=${frag.rect.left}, top=${frag.rect.top},
				right=${frag.rect.right}, bottom=${frag.rect.bottom}`
		);

		fragments.push({
			text: frag.text,
			rect: frag.rect,
			color: atom?.sty?.color,
			atom
		});
	}

	return fragments;
}

function mapFragmentsToTokens(editor: monaco.editor.IStandaloneCodeEditor, fragments: any[]) {
	const model = editor.getModel();
	if (!model) return [];

	const languageId = model.getLanguageId();
	const allTokens: { text: string; range: monaco.Range }[] = [];

	console.group('Collecting Tokens');
	// Collect all tokens from all lines, in order
	for (let line = 1; line <= model.getLineCount(); line++) {
		const content = model.getLineContent(line);
		const tokens = monaco.editor.tokenize(content, languageId)[0];
		if (!tokens) continue;

		for (let i = 0; i < tokens.length; i++) {
			const start = tokens[i].offset + 1;
			const end = i + 1 < tokens.length ? tokens[i + 1].offset + 1 : content.length + 1;
			const text = content.slice(start - 1, end - 1);

			allTokens.push({
				text,
				range: new monaco.Range(line, start, line, end)
			});

			console.log(text);
		}
	}
	console.groupEnd();

	// Now zip tokens ↔ fragments (1:1, in order)
	const minLen = Math.min(allTokens.length, fragments.length);
	const mapped = [];

	for (let i = 0; i < minLen; i++) {
		const frag = fragments[i];
		const tok = allTokens[i];

		mapped.push({
			frag,
			range: tok.range
		});
	}

	// --- Debug visibility ---
	console.group('Fragment ↔ Token Mapping');
	for (let i = 0; i < mapped.length; i++) {
		const m = mapped[i];
		console.log(
			`#${i}: "${m.frag.text}" ↔ line ${m.range.startLineNumber}, col ${m.range.startColumn}`,
			m.frag.rect
		);
	}
	console.groupEnd();

	return mapped;
}

function applyFragmentDecorations(
	editor: monaco.editor.IStandaloneCodeEditor,
	mapped: { frag: any; range: monaco.Range }[]
) {
	const model = editor.getModel();
	if (!model) return;

	const decorations = mapped.map(({ frag, range }) => {
		const x = frag.rect.left;
		const y = frag.rect.top;
		const color = frag.color || 'rgba(0, 150, 255, 0.2)';

		return {
			range,
			options: {
				inlineClassName: 'rb-inline-decoration',
				before: {
					content: '',
					inlineClassName: 'rb-spacer',
					// Translate layout coordinates into margin/padding
					// (you can tune these constants experimentally)
					margin: `0 0 0 ${x}px`
				},
				// Optional background highlight showing the fragment box
				inlineClassNameAffectsLetterSpacing: false
				// inlineClassName: 'rb-fragment-box'
			}
		};
	});

	console.group('Applying decorations');
	for (const d of decorations) {
		console.log(
			d.range.toString(),
			d.options.inlineClassName,
			d.options.inlineClassNameAffectsLetterSpacing
		);
	}
	console.groupEnd();

	model.deltaDecorations([], decorations);
}

let currentDecorations: string[] = [];
let currentSvgOverlay: HTMLDivElement | null = null;

async function updateRaggedBlocks() {
	console.group('🔄 RaggedBlocks Update');

	const model = editor.getModel();
	if (!model) return;

	// Step 1: Extract current editor text
	const source = model.getValue();
	console.log('Source:', source);

	// TODO: replace this with a real parser → LayoutTree from Monaco tokens
	// For now we’re still using the static LayoutTree for testing.
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

	// Step 2: Measure
	const measured = measureLayoutTree(tree, (text) => {
		const width = text.length * 8;
		const height = 16;
		return { left: 0, top: 0, right: width, bottom: height };
	});

	// Step 3: Run layout
	const algoSettings = new OutlinedRocksLayoutSettings(true, 10, true);
	const renderSettings = <RenderSettings>{
		renderDistanceMesh: false,
		renderFragmentBoundingBoxes: false
	};
	const algoName = 'L1S+';

	let result;
	try {
		result = await layout(measured, algoName, algoSettings, renderSettings, false);
		console.log('Layout done:', result.status);
	} catch (e) {
		console.error('Layout error:', e);
		return;
	}

	// Step 4: Extract fragments and map to tokens
	const fragments = await extractFragmentsFromLayout(measured, algoName, algoSettings);
	const mapped = mapFragmentsToTokens(editor, fragments);

	// Step 5: Clear and reapply decorations
	const modelDecorations = mapped.map(({ frag, range }) => ({
		range,
		options: {
			inlineClassName: 'rb-inline-decoration',
			before: {
				content: '',
				inlineClassName: 'rb-spacer',
				margin: `0 0 0 ${frag.rect.left}px`
			}
		}
	}));

	currentDecorations = model.deltaDecorations(currentDecorations, modelDecorations);
	console.log('Applied decorations:', currentDecorations.length);

	// Step 6: Overlay SVG
	// if (result.status === 'done') {
	// 	if (currentSvgOverlay) currentSvgOverlay.remove();

	// 	currentSvgOverlay = document.createElement('div');
	// 	currentSvgOverlay.style.position = 'absolute';
	// 	currentSvgOverlay.style.top = '0';
	// 	currentSvgOverlay.style.left = '0';
	// 	currentSvgOverlay.style.pointerEvents = 'none';
	// 	currentSvgOverlay.style.zIndex = '50';
	// 	currentSvgOverlay.innerHTML = result.svgSrc;

	// 	document.body.appendChild(currentSvgOverlay);
	// }

	console.groupEnd();
}

// Automatically update on editor content or layout changes
editor.onDidChangeModelContent(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidLayoutChange(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidScrollChange(() => requestAnimationFrame(updateRaggedBlocks));

// Kick off the first run after editor init
setTimeout(() => updateRaggedBlocks(), 200);
