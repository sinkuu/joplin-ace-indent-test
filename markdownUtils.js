const markdownUtils = {
	olLineNumber(line) {
		const match = line.match(/^(\d+)\.(\s.*|)$/);
		return match ? Number(match[1]) : 0;
	},
};

module.exports = markdownUtils;
