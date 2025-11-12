import * as monaco from 'monaco-editor';
import './index.css';
import { LayoutTree } from '../../src/layout-tree';
import layout, { RenderSettings } from '../../demo/layout';
import * as rb from '../../src/';
import { OutlinedRocksLayoutSettings, RocksLayoutSettings } from '../../src/rocks-layout/layout';
import { measureLayoutTree } from '../../src/layout-tree';
import parseExample from '../../demo/example-parser';

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

/*
pairs = [(i, j)
			for i in range(0, 10)
			for j in range(0, 10)
			if i != j]
*/
const editor = monaco.editor.create(document.body, {
	value: [
		'pairs =',
		'[(i, j)',
		'for i in range(0, 10)',
		'for j in range(0, 10)',
		'if i != j]'
	].join('\n'),
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

// // 3. Update token decorations (rocks between tokens)
// const newDecorations = [];

// for (let line = 1; line <= lineCount; line++) {
// 	const content = model.getLineContent(line);
// 	const tokens = monaco.editor.tokenize(content, model.getLanguageId())[0];

// 	if (!tokens || tokens.length === 0) continue;

// 	for (let i = 0; i < tokens.length; i++) {
// 		const endCol = i + 1 < tokens.length ? tokens[i + 1].offset + 1 : content.length + 1;

// 		newDecorations.push({
// 			range: new monaco.Range(line, endCol, line, endCol),
// 			options: {
// 				beforeContentClassName: 'rock-decoration',
// 				before: {
// 					content: '🪨'
// 				}
// 			}
// 		});
// 	}
// }

// // Apply decorations
// rockDecorationIds = model.deltaDecorations(rockDecorationIds, newDecorations);
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

	console.group('Extract Fragments');
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
	console.groupEnd();

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
			const range = new monaco.Range(line, start, line, end);

			allTokens.push({ text, range });
			console.log(`Token: "${text}"`, range);
		}
	}
	console.groupEnd();

	// --- Now match fragments to tokens (handles ", " combined fragments) ---
	const mapped: { frag: any; range: monaco.Range }[] = [];
	let tokenIndex = 0;

	console.group('Fragment to Token Mapping');
	for (const frag of fragments) {
		const fragText = frag.text;
		let mergedText = '';
		let startRange: monaco.Range | null = null;
		let endRange: monaco.Range | null = null;

		// Keep consuming tokens until we cover the full fragment text
		while (tokenIndex < allTokens.length && mergedText.length < fragText.length) {
			const tok = allTokens[tokenIndex];
			mergedText += tok.text;

			if (!startRange) startRange = tok.range;
			endRange = tok.range;
			tokenIndex++;

			// Stop if merged text matches fragment text
			if (mergedText === fragText) break;
		}

		if (startRange && endRange) {
			const mergedRange = new monaco.Range(
				startRange.startLineNumber,
				startRange.startColumn,
				endRange.endLineNumber,
				endRange.endColumn
			);
			mapped.push({ frag, range: mergedRange });
			console.log(
				`"${frag.text}" ↔ line ${mergedRange.startLineNumber}, col ${mergedRange.startColumn}`
			);
		} else {
			console.warn(`⚠️ Could not find token(s) for fragment "${frag.text}"`);
		}
	}
	console.groupEnd();

	return mapped;
}

// Global
let currentDecorations: string[] = [];

function applyFragmentDecorations(
	editor: monaco.editor.IStandaloneCodeEditor,
	mapped: { frag: any; range: monaco.Range }[]
) {
	const model = editor.getModel();
	if (!model) return;

	const newDecorations = [];
	let id = 0;

	// Compute average column width in Monaco
	const fontInfo = (editor as any)._configuration?.fontInfo;
	const columnWidth = fontInfo ? fontInfo.typicalHalfwidthCharacterWidth : 7;

	console.group('Applying decorations');
	// --- Compute spacer widths between fragments on the same line ---
	for (let i = 0; i < mapped.length; i++) {
		const current = mapped[i];
		const next = mapped[i + 1];

		// Width of token by characters
		const numColumns = current.range.endColumn - current.range.startColumn;

		// Width in layout space (from ragged-blocks)
		const layoutWidth = current.frag.rect.right - current.frag.rect.left;

		// Expected Monaco width (based on text)
		const tokenTextWidth = numColumns * columnWidth;

		// Spacer width = extra width needed to reach layout width
		let spacerWidth = layoutWidth - tokenTextWidth;
		if (spacerWidth < 0) spacerWidth = 0; // avoid negative spacing

		console.log(`${current.frag.text}
					Spacer width : ${spacerWidth}
					numColumns : ${numColumns}
					layoutWidth : ${layoutWidth}`);
		newDecorations.push({
			range: current.range,
			options: {
				beforeContentClassName: `rb-spacer-${current.frag.text}-${id}`,
				before: {
					content: ''
				}
			}
		});

		const style = document.createElement('style');
		style.textContent = `
			.monaco-editor .rb-spacer-${current.frag.text}-${id}::before {
				content: '';
				margin-left: 0px;
				margin-right: ${spacerWidth}px;
				font-size: 16px;
				color: goldenrod;
				user-select: none;
				pointer-events: none;
			}
		`;
		document.head.appendChild(style);
		id++;
	}

	// 2 Replace existing decorations instead of adding new ones
	currentDecorations = model.deltaDecorations(currentDecorations, newDecorations);

	console.log('Applied decorations (total):', currentDecorations.length);
	console.groupEnd();
}

async function updateRaggedBlocks() {
	console.group('RaggedBlocks Update');

	const model = editor.getModel();
	if (!model) return;

	// Step 1: Extract current editor text
	const source = model.getValue();
	console.log('Source:', source);

	// TODO: replace this with a real parser
	/*
	pairs = [(i, j)
				for i in range(0, 10)
				for j in range(0, 10)
				if i != j]
	*/
	const listCompExample = `
[pairs]@nm =
  [\\[ [([i]@nm, [j]@nm)]@expr
     [for [i]@nm in [range([0]@nm, [10]@nm)]@expr
     [for [j]@nm in [range([0]@nm, [10]@nm)]@expr
     [if [i]@nm != [j]@nm]@stmt]@stmt]@stmt \\]]@expr

@nm {
  fill: #FAFA37;
  border: 0 2;
}

@expr {
  padding: 2;
  fill: #FA9D5A;
  border: 1 1 #D27D46;
  border: 1 1 -1 #FFCBA4 top right;
}

@stmt {
  padding: 2;
  fill: gainsboro;
  border: 1 1 gray;
  border: 1 1 -1 white top right;
}`;

	const tree = parseExample(listCompExample);
	// console.log(compTree);
	if (typeof tree === 'string') {
		// Parse failed — `result` is an error message
		console.error('Parse error:', tree);
		throw new Error(tree);
	}

	// rb.removePadding(tree);
	// rb.randomizeFillColors(tree);

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
		renderFragmentBoundingBoxes: true,
		renderText: false
	};
	const algoName = 'L1S+';

	let result;
	try {
		result = await layout(measured, algoName, algoSettings, renderSettings, false);
		console.log('Layout done:', result.status);
		const svgContainer = document.createElement('div');
		svgContainer.innerHTML = result.svgSrc;
		// document.body.appendChild(svgContainer);
		const editorDom = editor.getDomNode();
		const viewLines = editorDom?.querySelector('.view-lines');
		if (viewLines) {
			svgContainer.style.position = 'absolute';
			svgContainer.style.pointerEvents = 'none';
			svgContainer.style.zIndex = '0'; // below text layer
			// svgContainer.style.opacity = '0.6';
			svgContainer.style.top = '0px';
			svgContainer.style.left = '0px';
			svgContainer.style.width = '100%';
			svgContainer.style.height = '100%';
			svgContainer.style.transform = 'translate(-9px, -8px)'; // adjust position
			viewLines.prepend(svgContainer); // place SVG beneath text
		}
	} catch (e) {
		console.error('Layout error:', e);
		return;
	}

	// Step 4: Extract fragments and map to tokens
	const fragments = await extractFragmentsFromLayout(measured, algoName, algoSettings);
	const mapped = mapFragmentsToTokens(editor, fragments);

	// Step 5: Clear and reapply decorations
	applyFragmentDecorations(editor, mapped);

	console.log('Applied decorations:', currentDecorations.length);

	console.groupEnd();
}

// Automatically update on editor content or layout changes
editor.onDidChangeModelContent(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidLayoutChange(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidScrollChange(() => requestAnimationFrame(updateRaggedBlocks));

// Kick off the first run after editor init
setTimeout(() => updateRaggedBlocks(), 200);
