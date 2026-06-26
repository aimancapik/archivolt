export const cn = (...args) => args.filter(Boolean).join(' ');

export const syntaxHighlight = (code, language) => {
  if (!code) return { __html: '' };
  let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const colors = {
    keyword: '#f92672', string: '#e6db74', tag: '#f92672',
    attr: '#a6e22e', comment: '#75715e', builtin: '#66d9ef'
  };

  if (language === 'javascript' || language === 'js') {
    html = html
      .replace(/(\/\/.*)/g, '__COMMENT_START__$1__COMMENT_END__')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|'.*?'|`.*?`)/g, '__STRING_START__$1__STRING_END__')
      .replace(/\b(import|export|default|from|function|return|const|let|var|if|else|for|while|new)\b/g, '__KEYWORD_START__$1__KEYWORD_END__')
      .replace(/\b(console|document|window|Date)\b/g, '__BUILTIN_START__$1__BUILTIN_END__')
      .replace(/(&lt;\/?[A-Za-z0-9]+)/g, '__ATTR_START__$1__ATTR_END__');
  } else if (language === 'html' || language === 'playground') {
    html = html
      .replace(/(&lt;!--.*?--&gt;)/g, '__COMMENT_START__$1__COMMENT_END__')
      .replace(/(&quot;.*?&quot;|'.*?')/g, '__STRING_START__$1__STRING_END__')
      .replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1__TAG_START__$2__TAG_END__')
      .replace(/\b([a-zA-Z-]+)(?=\s*=)/g, '__ATTR_START__$1__ATTR_END__');
  } else if (language === 'bash') {
    html = html
      .replace(/(#.*)/g, '__COMMENT_START__$1__COMMENT_END__')
      .replace(/^(npm|yarn|npx|&gt;)/gm, '__KEYWORD_START__$1__KEYWORD_END__')
      .replace(/\b(install|add|remove|--force)\b/g, '__BUILTIN_START__$1__BUILTIN_END__');
  }

  html = html
    .replace(/__COMMENT_START__/g, `<span style="color: ${colors.comment}">`)
    .replace(/__COMMENT_END__/g, '</span>')
    .replace(/__STRING_START__/g, `<span style="color: ${colors.string}">`)
    .replace(/__STRING_END__/g, '</span>')
    .replace(/__TAG_START__/g, `<span style="color: ${colors.tag}">`)
    .replace(/__TAG_END__/g, '</span>')
    .replace(/__ATTR_START__/g, `<span style="color: ${colors.attr}">`)
    .replace(/__ATTR_END__/g, '</span>')
    .replace(/__KEYWORD_START__/g, `<span style="color: ${colors.keyword}">`)
    .replace(/__KEYWORD_END__/g, '</span>')
    .replace(/__BUILTIN_START__/g, `<span style="color: ${colors.builtin}">`)
    .replace(/__BUILTIN_END__/g, '</span>');

  return { __html: html };
};

export const formatCode = (code) => {
  if (!code) return '';

  const cleaned = code
    .replace(/\s*\{\s*/g, ' {\n')
    .replace(/\s*\}\s*/g, '\n}\n')
    .replace(/\s*;\s*/g, ';\n')
    .replace(/\n+/g, '\n');

  const lines = cleaned.split('\n').map(line => line.trim());
  const formatted = [];
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (line.startsWith('}') || line.startsWith('</')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    formatted.push('  '.repeat(indentLevel) + line);

    if (line.endsWith('{') || (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</') && !line.startsWith('<!'))) {
      indentLevel++;
    }
  }

  return formatted.join('\n').trim();
};
