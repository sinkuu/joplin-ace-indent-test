const { editorFrom } = require('../index.js');
const { Range } = require('ace/lib/ace/range');

describe('Customized Markdown behavior', () => {
	it('deletes the list markup from an empty list item on Enter', () => {
		const editor = editorFrom('* ');
		editor.moveCursorTo(0, 2);
		editor.execCommand('enter');
		expect(editor.getValue()).toBe('');
	});

	it('does not delete the list markup from an non-empty list item on Enter', () => {
		const editor = editorFrom('* list');
		editor.navigateFileEnd();
		editor.execCommand('enter');
		expect(editor.getValue()).toBe('* list\n* ');
		expect(editor.getCursorPosition().row).toBe(1);
	});

	it('delets multiple list markups from multiply-selected empty list items on Enter', () => {
		const editor = editorFrom('* \n* foo\n* ');
		let ranges = [
			new Range(0, 2, 0, 2),
			new Range(1, 3, 1, 3),
			new Range(1, 4, 1, 4),
			new Range(2, 2, 2, 2)
		];
		editor.selection.fromOrientedRange(ranges.shift());
		for (let r of ranges) {
			editor.selection.addRange(r);
		}
		editor.execCommand('enter');
		expect(editor.getValue()).toBe('\n* f\n* o\n* o\n');
	});

	it('indents a list item instead of inserting a tab at cursor', () => {
		const editor = editorFrom('* list');
		editor.moveCursorTo(0, 2);
		editor.indent();
		expect(editor.getValue()).toBe('\t* list');
	});

	it('increases the item number on newline', () => {
		const editor = editorFrom('1. foo');
		editor.navigateFileEnd();
		editor.execCommand('enter');
		expect(editor.getValue()).toBe('1. foo\n2. ');
		expect(editor.getCursorPosition().row).toBe(1);
	});

	it('resets the item number when indenting', () => {
		const editor = editorFrom('1. foo\n2. bar');
		editor.navigateFileEnd();
		editor.indent();
		expect(editor.getValue()).toBe('1. foo\n\t1. bar');
	});

	it('corrects the item number when unindenting', () => {
		const editor = editorFrom('1. foo\n\t1. bar');
		editor.navigateFileEnd();
		editor.execCommand('outdent');
		expect(editor.getValue()).toBe('1. foo\n2. bar');
	});

	it('corrects the item number when indenting', () => {
		const editor = editorFrom(['1. foo', '\t1. bar', '\t2. baz', '2. qux']);
		editor.navigateFileEnd();
		editor.indent();
		expect(editor.getValue()).toBe(
			['1. foo', '\t1. bar', '\t2. baz', '\t3. qux'].join('\n')
		);
	});
});
