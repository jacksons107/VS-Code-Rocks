import * as monaco from 'monaco-editor';
import './index.css';
import { LayoutTree, Node, Spacer, Atom, Newline } from '../../src/layout-tree';
import layout, { RenderSettings } from '../../demo/layout';
import * as rb from '../../src/';
import { OutlinedRocksLayoutSettings, RocksLayoutSettings } from '../../src/rocks-layout/layout';
import { measureLayoutTree } from '../../src/layout-tree';
import parseExample from '../../demo/example-parser';

import { Parser, Language } from 'web-tree-sitter';

// Initialize Tree Sitter Parser for Python
await Parser.init();
const parser = new Parser();
const Python = await Language.load('../public/tree-sitter-python.wasm');
parser.setLanguage(Python);

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
		'[ (i, j)',
		'for i in range(0, 10)',
		'for j in range(0, 10)',
		'if i != j ]'
	].join('\n'),
	language: 'python'
});

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

		// console.log(
		// 	`${frag.text}: left=${frag.rect.left}, top=${frag.rect.top},
		// 		right=${frag.rect.right}, bottom=${frag.rect.bottom}`
		// );

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
			// console.log(`Token: "${text}"`, range);
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
			// console.log(
			// 	`"${frag.text}" ↔ line ${mergedRange.startLineNumber}, col ${mergedRange.startColumn}`
			// );
		} else {
			console.warn(`Could not find token(s) for fragment "${frag.text}"`);
		}
	}
	console.groupEnd();

	return mapped;
}

function computeLineSpacingFromFragments(fragments: any[]) {
	if (!fragments.length) return [];

	// --- Step 1: Group fragments by their vertical “line” level ---
	// We’ll cluster fragments by their rect.top value (within a small epsilon).
	const epsilon = 2; // tolerance in px for grouping fragments into same line
	const lines: { top: number; bottom: number; frags: any[] }[] = [];

	for (const frag of fragments) {
		const { top, bottom } = frag.rect;
		// Try to find an existing line group with similar top
		let found = false;
		for (const line of lines) {
			if (Math.abs(line.top - top) < epsilon) {
				line.frags.push(frag);
				line.top = Math.min(line.top, top);
				line.bottom = Math.max(line.bottom, bottom);
				found = true;
				break;
			}
		}
		if (!found) {
			lines.push({ top, bottom, frags: [frag] });
		}
	}

	// Sort lines top→bottom
	lines.sort((a, b) => a.top - b.top);

	// --- Step 2: Compute vertical gaps between consecutive lines ---
	const verticalGaps: { lineIndex: number; gap: number }[] = [];

	for (let i = 0; i < lines.length - 1; i++) {
		const current = lines[i];
		const next = lines[i + 1];
		const gap = next.top - current.bottom;
		verticalGaps.push({ lineIndex: i, gap });
		// console.log(
		// 	`Gap between line ${i} and ${i + 1}: ${gap.toFixed(2)}px (bottom=${current.bottom.toFixed(
		// 		1
		// 	)}, next.top=${next.top.toFixed(1)})`
		// );
	}

	// console.log('Computed line vertical gaps:', verticalGaps);
	return verticalGaps;
}

// global
let currentDecorations: string[] = [];
let currentViewZoneIds: string[] = [];

function applyFragmentDecorations(
	editor: monaco.editor.IStandaloneCodeEditor,
	mapped: { frag: any; range: monaco.Range }[],
	lineGaps: { lineIndex: number; gap: number }[]
) {
	const model = editor.getModel();
	if (!model) return;

	// Get approximate column width from editor (fallback to 7)
	const fontInfo = (editor as any)._configuration?.fontInfo;
	const columnWidth = fontInfo ? fontInfo.typicalHalfwidthCharacterWidth : 7;

	const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
	const cssRules: string[] = [];
	let lineHeights = [];

	console.group('Horizontal Spacers');
	for (let i = 0; i < mapped.length; i++) {
		const { frag, range } = mapped[i];

		// basic token info
		const startCol = range.startColumn;
		const endCol = range.endColumn;
		const numColumns = Math.max(0, endCol - startCol); // token length in columns

		// layout widths from ragged-blocks
		const layoutWidth = frag.rect.right - frag.rect.left;
		const tokenTextWidth = numColumns * columnWidth;

		// baseline approx X for this token (in layout/editor column pixels)
		const tokenBaselineX = (startCol - 1) * columnWidth;

		// if this is the first token on the line (column 1) or close to it,
		// we need to account for left offset: frag.rect.left - tokenBaselineX
		// (only positive offsets matter)
		const extraLeft = Math.max(0, frag.rect.left - tokenBaselineX);

		// compute spacer width: right spacer + possibly extra left shift for first token
		let spacerWidth = layoutWidth - tokenTextWidth;
		if (spacerWidth < 0) spacerWidth = 0;
		// add left offset only when token is near start of line; you could
		if (startCol === 1) {
			spacerWidth += extraLeft;
		}

		// clamp
		spacerWidth = Math.max(0, spacerWidth);

		// class name for this spacer (unique per-decoration)
		const className = `rb-spacer-${i}`;

		// push decoration that creates a before pseudo-element (affects flow)
		newDecorations.push({
			range,
			options: {
				beforeContentClassName: className,
				// prevent decoration from greedily growing while typing
				stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
			}
		});

		// create CSS rule for this particular spacer
		// using margin-right on ::before will put spacing between the pseudo element and token
		// (we keep width:0 so we rely on margin to push, and background for debug)
		const color = frag.color || 'rgba(0,150,255,0.12)';
		cssRules.push(`
			.monaco-editor .${className}::before {
				content: '';
				display: inline-block;
				width: 0;
				margin-right: ${spacerWidth}px;
				margin-left: 0;
				height: 1em;
				background: ${color};
				opacity: 0.35;
				user-select: none;
				pointer-events: none;
			}
		`);

		// console.log(
		// 	`#${i} "${
		// 		frag.text
		// 	}" startCol=${startCol} numCols=${numColumns} layoutW=${layoutWidth.toFixed(
		// 		2
		// 	)} tokenW=${tokenTextWidth.toFixed(2)} extraLeft=${extraLeft.toFixed(
		// 		2
		// 	)} spacer=${spacerWidth.toFixed(2)}`
		// );
	}

	console.groupEnd();

	// replace old decorations
	currentDecorations = model.deltaDecorations(currentDecorations, newDecorations);

	// update a single style element with all per-spacer rules
	let styleEl = document.getElementById('rb-spacer-style') as HTMLStyleElement | null;
	if (!styleEl) {
		styleEl = document.createElement('style');
		styleEl.id = 'rb-spacer-style';
		document.head.appendChild(styleEl);
	}
	styleEl.textContent = cssRules.join('\n');

	console.log('Applied horizontal spacers (count):', currentDecorations.length);

	console.group('Vertical Spacers');

	// --- Apply view zones based on line gaps ---
	editor.changeViewZones((accessor) => {
		// Remove old zones first
		for (const zid of currentViewZoneIds) accessor.removeZone(zid);
		currentViewZoneIds = [];

		for (const { lineIndex, gap } of lineGaps) {
			if (gap <= 0) continue; // skip negative or zero gaps

			const domNode = document.createElement('div');
			domNode.style.height = `${gap - 1}px`;
			domNode.style.pointerEvents = 'none';
			domNode.style.userSelect = 'none';
			// domNode.style.background = 'rgba(255, 215, 0, 0.1)'; // light gold tint to debug gaps

			const zoneId = accessor.addZone({
				afterLineNumber: lineIndex + 1, // Monaco lines are 1-indexed
				heightInPx: gap - 1,
				domNode
			});

			currentViewZoneIds.push(zoneId);
			// console.log(`Added view zone after line ${lineIndex + 1} (height ${gap}px)`);
		}
	});

	console.groupEnd();
}

interface Token {
	type: string;
	text: string;
	startIndex: number;
	endIndex: number;
}

interface ASTNode {
	type: string;
	startIndex: number;
	endIndex: number;
	astChildren: ASTNode[];
	cstChildren: Array<ASTNode | Token>;
}

/* ──────────────────────────────────────────────────────────────
 * Step 1 — Walk the tree and collect all leaf nodes (tokens)
 * ────────────────────────────────────────────────────────────── */
function collectTokens(node, source, tokens = []) {
	if (node.childCount === 0) {
		tokens.push({
			type: node.type,
			text: source.slice(node.startIndex, node.endIndex),
			startIndex: node.startIndex,
			endIndex: node.endIndex
			// isNamed: node.isNamed()
		});
	} else {
		for (const child of node.children) {
			collectTokens(child, source, tokens);
		}
	}
	return tokens;
}

/* ──────────────────────────────────────────────────────────────
 * Step 2 — Wrap Tree-sitter AST nodes into our structure
 * ────────────────────────────────────────────────────────────── */

function wrapNode(tsNode): ASTNode {
	return {
		type: tsNode.type,
		startIndex: tsNode.startIndex,
		endIndex: tsNode.endIndex,
		astChildren: tsNode.children.map(wrapNode),
		cstChildren: [] // will be filled later
	};
}

/* ──────────────────────────────────────────────────────────────
 * Step 3 — Token insertion based on interval containment
 * ────────────────────────────────────────────────────────────── */

function tokenBelongs(node: ASTNode, tok: Token): boolean {
	return node.startIndex <= tok.startIndex && tok.endIndex <= node.endIndex;
}

function insertToken(node: ASTNode, tok: Token): void {
	// 1. Descend into AST children if the token fits in any of them
	for (const child of node.astChildren) {
		if (tokenBelongs(child, tok)) {
			insertToken(child, tok);
			return;
		}
	}

	// 2. Token does not fit in any children → it belongs here.
	// Insert in sorted order by startIndex.
	let i = 0;
	while (i < node.cstChildren.length && node.cstChildren[i].startIndex <= tok.startIndex) {
		i++;
	}
	node.cstChildren.splice(i, 0, tok);
}

/* ──────────────────────────────────────────────────────────────
 * Step 4 — Build the full CST
 * ────────────────────────────────────────────────────────────── */

function buildCST(rootNode, source: string): ASTNode {
	const tokens = collectTokens(rootNode, source);
	const wrapped = wrapNode(rootNode);

	for (const tok of tokens) {
		insertToken(wrapped, tok);
	}

	console.log('Wrapped:', wrapped);
	return wrapped;
}

/* ──────────────────────────────────────────────────────────────
 * Step 5 — Convert CST → LayoutTree
 * ────────────────────────────────────────────────────────────── */

function toLayoutTree(node: ASTNode | Token): LayoutTree {
	if (isToken(node)) {
		return { type: 'Atom', text: node.text };
	}

	return {
		type: 'Node',
		padding: 0,
		children: node.cstChildren.map(toLayoutTree)
	};
}

function isToken(x: ASTNode | Token): x is Token {
	return (x as any).text !== undefined;
}

async function updateRaggedBlocks() {
	console.group('RaggedBlocks Update');

	const model = editor.getModel();
	if (!model) return;

	// Step 1: Extract current editor text
	const source = model.getValue();
	console.log('Source:', source);

	// Step 2: Parse with Tree Sitter
	const tsTree = parser.parse(source);
	console.log('Tree-sitter AST:', tsTree.rootNode.toString());

	// Step 3: Collect tokens with postions from AST
	// const tokens = collectTokens(tsTree.rootNode, source);
	// console.log('Tree sitter tokens:', tokens);

	const cst = buildCST(tsTree.rootNode, source);
	const layoutTree = toLayoutTree(cst);
	console.log('Generated LayoutTree:', layoutTree);

	// TODO: replace this with a real parser
	/*
	pairs = [(i, j)
				for i in range(0, 10)
				for j in range(0, 10)
				if i != j]
	*/
	const listCompExample = `[pairs]@nm =
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
	console.log('Example Tree:', tree);
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
		renderFragmentBoundingBoxes: false,
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
	const lineGaps = computeLineSpacingFromFragments(fragments);

	// Step 5: Clear and reapply decorations
	applyFragmentDecorations(editor, mapped, lineGaps);

	console.groupEnd();
}

// Automatically update on editor content or layout changes
editor.onDidChangeModelContent(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidLayoutChange(() => requestAnimationFrame(updateRaggedBlocks));
editor.onDidScrollChange(() => requestAnimationFrame(updateRaggedBlocks));

// Kick off the first run after editor init
setTimeout(() => updateRaggedBlocks(), 200);

// (module
// 	(expression_statement
// 		(assignment
// 			left: (identifier)
// 			right: (list_comprehension
// 						body: (tuple (identifier) (identifier))
// 						(for_in_clause
// 							left: (identifier)
// 							right: (call
// 										function: (identifier)
// 										arguments: (argument_list (integer) (integer))))
// 						(for_in_clause
// 							left: (identifier)
// 							right: (call
// 										function: (identifier)
// 										arguments: (argument_list (integer) (integer))))
// 						(if_clause (comparison_operator (identifier) (identifier)))))))
