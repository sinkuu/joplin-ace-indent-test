'use strict';

require('amd-loader');
const { Editor, EditSession } = require('ace/lib/ace/ace.js');
const { MockRenderer } = require('ace/lib/ace/test/mockrenderer');
const markdownUtils = require('./markdownUtils');

class NoteText {
	constructor(editor) {
		this.editor_ = { editor };
		this.setup();
	}

	setup() {
		const lineLeftSpaces = function(line) {
			let output = '';
			for (let i = 0; i < line.length; i++) {
				if ([' ', '\t'].indexOf(line[i]) >= 0) {
					output += line[i];
				} else {
					break;
				}
			}
			return output;
		};

		// Disable Markdown auto-completion (eg. auto-adding a dash after a line with a dash.
		// https://github.com/ajaxorg/ace/issues/2754
		this.editor_.editor.getSession().getMode().getNextLineIndent = function(
			state,
			line
		) {
			const leftSpaces = lineLeftSpaces(line);
			const lineNoLeftSpaces = line.trimLeft();

			if (
				lineNoLeftSpaces.indexOf('- [ ] ') === 0 ||
				lineNoLeftSpaces.indexOf('- [x] ') === 0 ||
				lineNoLeftSpaces.indexOf('- [X] ') === 0
			)
				return `${leftSpaces}- [ ] `;
			if (lineNoLeftSpaces.indexOf('- ') === 0) return `${leftSpaces}- `;
			if (lineNoLeftSpaces.indexOf('* ') === 0 && line.trim() !== '* * *')
				return `${leftSpaces}* `;

			const bulletNumber = markdownUtils.olLineNumber(lineNoLeftSpaces);
			if (bulletNumber) return `${leftSpaces + (bulletNumber + 1)}. `;

			return this.$getIndent(line);
		};

		// Returns tokens of the line if it starts with a 'markup.list' token.
		const listTokens = (editor, row) => {
			const tokens = editor.session.getTokens(row);
			if (!tokens.length || tokens[0].type !== 'markup.list') {
				return [];
			}
			return tokens;
		};

		// Finds the list item with indent level `prevIndent`.
		const findPrevListNum = (editor, row, prevIndent) => {
			const indentStr = '\t'.repeat(prevIndent);
			while (row > 0) {
				row--;
				const line = editor.session.getLine(row);

				if (!line.startsWith(indentStr)) {
					break;
				}

				const num = markdownUtils.olLineNumber(line.slice(prevIndent));
				if (num) {
					return num;
				}
			}
			return 0;
		};

		// Markdown list indentation. (https://github.com/laurent22/joplin/pull/2713)
		// If the current line starts with `markup.list` token,
		// hitting `Tab` key indents the line instead of inserting tab at cursor.
		this.indentOrig = this.editor_.editor.indent;
		const indentOrig = this.indentOrig;
		this.editor_.editor.indent = function() {
			const range = this.getSelectionRange();
			if (range.isEmpty()) {
				const row = range.start.row;
				const tokens = listTokens(this, row);

				if (tokens) {
					if (tokens[0].value.search(/\d+\./) != -1) {
						const line = this.session.getLine(row);
						// Number of `\t`
						const indent = Array.prototype.findIndex.call(
							line,
							c => c !== '\t'
						);
						const n = findPrevListNum(this, row, indent + 1) + 1;
						this.session.replace(
							{
								start: { row, column: 0 },
								end: { row, column: tokens[0].value.length }
							},
							tokens[0].value.replace(/\d+\./, `${n}.`)
						);
					}

					this.session.indentRows(row, row, '\t');
					return;
				}
			}

			indentOrig.call(this);
		};

		// Delete a list markup (e.g. `- `) from an empty list item on hitting Enter.
		// (https://github.com/laurent22/joplin/pull/2772)
		this.editor_.editor.commands.addCommand({
			name: 'enter',
			bindKey: 'Enter',
			multiSelectAction: 'forEach',
			exec: function(editor) {
				const range = editor.getSelectionRange();
				const tokens = listTokens(editor, range.start.row);

				const emptyListItem = tokens.length === 1;
				const emptyCheckboxItem =
					tokens.length === 3 &&
					['[ ]', '[x]'].includes(tokens[1].value) &&
					tokens[2].value === ' ';

				if (!range.isEmpty() || !(emptyListItem || emptyCheckboxItem)) {
					editor.insert('\n');
					// Cursor can go out of the view after inserting '\n'.
					editor.renderer.scrollCursorIntoView();
					return;
				}

				const row = range.start.row;
				const line = editor.session.getLine(row);
				let indent = editor
					.getSession()
					.getMode()
					.getNextLineIndent(null, line);
				if (indent.startsWith('\t')) {
					indent = indent.slice(1);
				} else {
					indent = '';
				}

				editor.session.replace(
					{
						start: { row, column: 0 },
						end: { row, column: line.length }
					},
					indent
				);
			},
			readOnly: false
		});

		// Correct the number of numbered list item when outdenting.
		this.editor_.editor.commands.addCommand({
			name: 'outdent',
			bindKey: { win: 'Shift+Tab', mac: 'Shift+Tab' },
			multiSelectAction: 'forEachLine',
			exec: function(editor) {
				const range = editor.getSelectionRange();
				if (range.isEmpty()) {
					const row = range.start.row;

					const tokens = listTokens(editor, row);
					if (tokens.length) {
						const matches = tokens[0].value.match(/^(\t+)\d+\./);
						if (matches && matches.length) {
							const indent = matches[1].length;
							const n = findPrevListNum(editor, row, indent - 1) + 1;
							editor.session.replace(
								{
									start: { row, column: 0 },
									end: { row, column: tokens[0].value.length }
								},
								tokens[0].value.replace(/\d+\./, `${n}.`)
							);
						}
					}
				}

				editor.blockOutdent();
			},
			readonly: false
		});
	}

	editor() {
		return this.editor_.editor;
	}
}

exports.editorFrom = value => {
	if (Array.isArray(value)) {
		value = value.join('\n');
	}

	const session = new EditSession(value);
	const nt = new NoteText(
		new Editor(new MockRenderer(), session, {
			behavioursEnabled: true,
			useSoftTabs: false,
			mode: 'ace/lib/ace/mode/markdown'
		})
	);
	return nt.editor();
};
