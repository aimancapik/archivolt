export const cn = (...args) => args.filter(Boolean).join(' ');

export const syntaxHighlight = (code, language) => {
  if (!code) return { __html: '' };
  let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const colors = {
    keyword: '#f92672', string: '#e6db74', tag: '#f92672',
    attr: '#a6e22e', comment: '#75715e', builtin: '#66d9ef',
    method: '#8be9fd', property: '#bd93f9', number: '#ae81ff',
    operator: '#ff79c6', type: '#50fa7b'
  };

  if (['javascript', 'js', 'typescript', 'ts'].includes(language)) {
    html = html
      .replace(/(\/\/.*)/g, '__COMMENT_START__$1__COMMENT_END__')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|'.*?'|`.*?`)/g, '__STRING_START__$1__STRING_END__')
      .replace(/\b(import|export|default|from|function|return|const|let|var|if|else|for|while|new|class|interface|type|public|private|protected|readonly|async|await|delete)\b/g, '__KEYWORD_START__$1__KEYWORD_END__')
      .replace(/\b(this|true|false|null|undefined|console|document|window|Date|Promise|Observable|String|Number|Boolean|Array)\b/g, '__BUILTIN_START__$1__BUILTIN_END__')
      .replace(/\b(string|number|boolean|void|unknown|any|never)\b/g, '__TYPE_START__$1__TYPE_END__')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '__NUMBER_START__$1__NUMBER_END__')
      .replace(/(\.\s*)([A-Za-z_$][\w$]*)(?=\s*\()/g, '$1__METHOD_START__$2__METHOD_END__')
      .replace(/(\.\s*)([A-Za-z_$][\w$]*)/g, '$1__PROPERTY_START__$2__PROPERTY_END__')
      .replace(/(===|!==|=>|&&|\|\||[=?:])/g, '__OPERATOR_START__$1__OPERATOR_END__')
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
    .replace(/__BUILTIN_END__/g, '</span>')
    .replace(/__METHOD_START__/g, `<span style="color: ${colors.method}">`)
    .replace(/__METHOD_END__/g, '</span>')
    .replace(/__PROPERTY_START__/g, `<span style="color: ${colors.property}">`)
    .replace(/__PROPERTY_END__/g, '</span>')
    .replace(/__NUMBER_START__/g, `<span style="color: ${colors.number}">`)
    .replace(/__NUMBER_END__/g, '</span>')
    .replace(/__OPERATOR_START__/g, `<span style="color: ${colors.operator}">`)
    .replace(/__OPERATOR_END__/g, '</span>')
    .replace(/__TYPE_START__/g, `<span style="color: ${colors.type}">`)
    .replace(/__TYPE_END__/g, '</span>');

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
