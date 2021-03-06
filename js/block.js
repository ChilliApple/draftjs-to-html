import {
  forEach,
  isEmptyString,
} from './common';

/**
* Mapping object of block to corresponding html tag.
*/
const blockTypesMapping: Object = {
  unstyled: 'p',
  'header-one': 'h1',
  'header-two': 'h2',
  'header-three': 'h3',
  'header-four': 'h4',
  'header-five': 'h5',
  'header-six': 'h6',
  'unordered-list-item': 'ul',
  'ordered-list-item': 'ol',
  blockquote: 'blockquote',
};

/**
* Function will return HTML block tag for a block.
*/
export function getBlockTag(type: string): string {
  return type && blockTypesMapping[type];
}

/**
* The function returns an array of sections in blocks.
* Sections will be areas in block which have same entity or no entity applicable to them.
*/
function getEntitySections(entityRanges: Object, blockLength: number): Array<Object> {
  const sections = [];
  let lastOffset = 0;
  entityRanges.forEach((r) => {
    if (r.offset > lastOffset) {
      sections.push({
        start: lastOffset,
        end: r.offset - 1,
      });
    }
    sections.push({
      start: r.offset,
      end: r.offset + r.length,
      entityKey: r.key,
    });
    lastOffset = r.offset + r.length;
  });
  if (lastOffset < blockLength) {
    sections.push({
      start: lastOffset,
      end: blockLength,
    });
  }
  return sections;
}

/**
* Function to check if the block is an atomic entity block.
*/
function isAtomicEntityBlock(block: Object): boolean {
  if (block.entityRanges.length > 0 && isEmptyString(block.text)) {
    return true;
  }
  return false;
}

/**
* The function will return array of inline styles applicable to the block.
*/
function getStyleArrayForBlock(block: Object): Object {
  const { text, inlineStyleRanges } = block;
  const inlineStyles = {
    BOLD: new Array(text.length),
    ITALIC: new Array(text.length),
    UNDERLINE: new Array(text.length),
    STRIKETHROUGH: new Array(text.length),
    CODE: new Array(text.length),
    COLOR: new Array(text.length),
    BGCOLOR: new Array(text.length),
    FONTSIZE: new Array(text.length),
    FONTFAMILY: new Array(text.length),
    length: text.length,
  };
  if (inlineStyleRanges && inlineStyleRanges.length > 0) {
    inlineStyleRanges.forEach((range) => {
      const offset = range.offset;
      const length = offset + range.length;
      for (let i = offset; i < length; i++) {
        if (range.style.startsWith('color-')) {
          inlineStyles.COLOR[i] = range.style.substring(6);
        } else if (range.style.startsWith('bgcolor-')) {
          inlineStyles.BGCOLOR[i] = range.style.substring(8);
        } else if (range.style.startsWith('fontsize-')) {
          inlineStyles.FONTSIZE[i] = range.style.substring(9);
        } else if (range.style.startsWith('fontfamily-')) {
          inlineStyles.FONTFAMILY[i] = range.style.substring(11);
        } else if (inlineStyles[range.style]) {
          inlineStyles[range.style][i] = true;
        }
      }
    });
  }
  return inlineStyles;
}

/**
* The function will return inline style applicable at some offset within a block.
*/
export function getStylesAtOffset(inlineStyles: Object, offset: number): Object {
  const styles = {};
  if (inlineStyles.COLOR[offset]) {
    styles.COLOR = inlineStyles.COLOR[offset];
  }
  if (inlineStyles.BGCOLOR[offset]) {
    styles.BGCOLOR = inlineStyles.BGCOLOR[offset];
  }
  if (inlineStyles.FONTSIZE[offset]) {
    styles.FONTSIZE = inlineStyles.FONTSIZE[offset];
  }
  if (inlineStyles.FONTFAMILY[offset]) {
    styles.FONTFAMILY = inlineStyles.FONTFAMILY[offset];
  }
  if (inlineStyles.UNDERLINE[offset]) {
    styles.UNDERLINE = true;
  }
  if (inlineStyles.ITALIC[offset]) {
    styles.ITALIC = true;
  }
  if (inlineStyles.BOLD[offset]) {
    styles.BOLD = true;
  }
  if (inlineStyles.STRIKETHROUGH[offset]) {
    styles.STRIKETHROUGH = true;
  }
  if (inlineStyles.CODE[offset]) {
    styles.CODE = true;
  }
  return styles;
}

/**
* Function returns true for a set of styles if the value of these styles at an offset
* are same as that on the previous offset.
*/
export function sameStyleAsPrevious(
  inlineStyles: Object,
  styles: Array<string>,
  index: number
): boolean {
  let sameStyled = true;
  if (index > 0 && index < inlineStyles.length) {
    styles.forEach((style) => {
      sameStyled = sameStyled && inlineStyles[style][index] === inlineStyles[style][index - 1];
    });
  } else {
    sameStyled = false;
  }
  return sameStyled;
}

/**
* Function returns html for text depending on inline style tags applicable to it.
*/
export function addInlineStyleMarkup(style: string, content: string): string {
  if (style === 'BOLD') {
    return `<strong>${content}</strong>`;
  } else if (style === 'ITALIC') {
    return `<em>${content}</em>`;
  } else if (style === 'UNDERLINE') {
    return `<ins>${content}</ins>`;
  } else if (style === 'STRIKETHROUGH') {
    return `<del>${content}</del>`;
  } else if (style === 'CODE') {
    return `<code>${content}</code>`;
  }
  return content;
}

/**
* Function returns html for text depending on inline style tags applicable to it.
*/
export function addStylePropertyMarkup(styles: string, content: string): string {
  if (styles && (styles.COLOR || styles.BGCOLOR || styles.FONTSIZE || styles.FONTFAMILY)) {
    let styleString = 'style="';
    if (styles.COLOR) {
      styleString += `color: ${styles.COLOR};`;
    }
    if (styles.BGCOLOR) {
      styleString += `background-color: ${styles.BGCOLOR};`;
    }
    if (styles.FONTSIZE) {
      styleString += `font-size: ${styles.FONTSIZE};`;
    }
    if (styles.FONTFAMILY) {
      styleString += `font-family: ${styles.FONTFAMILY};`;
    }
    styleString += '"';
    return `<span ${styleString}>${content}</span>`;
  }
  return content;
}

/**
* Function will return markup for Entity.
*/
function getEntityMarkup(entityMap: Object, entityKey: number, text: string): string {
  const entity = entityMap[entityKey];
  if (entity.type === 'LINK') {
    return `<a href="${entity.data.url}">${text}</a>`;
  }
  if (entity.type === 'IMAGE') {
    return `<img src="${entity.data.src}" style="float:${entity.data.alignment || 'none'}"/>`;
  }
  return text;
}

/**
* For a given section in a block the function will return a further list of sections,
* with similar inline styles applicable to them.
*/
function getInlineStyleSections(
  block: Object,
  styles: Array<string>,
  start: number,
  end: number
): Array<Object> {
  const styleSections = [];
  const { text } = block;
  if (text.length > 0) {
    const inlineStyles = getStyleArrayForBlock(block);
    let section;
    for (let i = start; i < end; i++) {
      if (i !== start && sameStyleAsPrevious(inlineStyles, styles, i)) {
        section.text.push(text[i]);
        section.end = i + 1;
      } else {
        section = {
          styles: getStylesAtOffset(inlineStyles, i),
          text: [text[i]],
          start: i,
          end: i + 1,
        };
        styleSections.push(section);
      }
    }
  }
  return styleSections;
}

/**
* The function returns text for given section of block after doing required character replacements.
*/
function getSectionText(text: Array<string>): string {
  if (text && text.length > 0) {
    const chars = text.map((ch) => {
      switch (ch) {
        case '\n':
          return '<br>\n';
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        default:
          return ch;
      }
    });
    return chars.join('');
  }
  return '';
}

/**
* Replace leading blank spaces by &nbsp;
*/
export function trimLeadingZeros(sectionText: string): string {
  if (sectionText) {
    let replacedText = sectionText;
    for (let i = 0; i < replacedText.length; i++) {
      if (sectionText[i] === ' ') {
        replacedText = replacedText.replace(' ', '&nbsp;');
      } else {
        break;
      }
    }
    return replacedText;
  }
  return sectionText;
}

/**
* Replace trailing blank spaces by &nbsp;
*/
export function trimTrailingZeros(sectionText: string): string {
  if (sectionText) {
    let replacedText = sectionText;
    for (let i = replacedText.length - 1; i >= 0; i--) {
      if (replacedText[i] === ' ') {
        replacedText = `${replacedText.substring(0, i)}&nbsp;${replacedText.substring(i + 1)}`;
      } else {
        break;
      }
    }
    return replacedText;
  }
  return sectionText;
}

/**
* The method returns markup for section to which inline styles
* like BOLD, UNDERLINE and ITALIC are applicable.
*/
function getStyleTagSectionMarkup(styleSection: Object): string {
  let text = getSectionText(styleSection.text);
  forEach(styleSection.styles, (style, value) => {
    text = addInlineStyleMarkup(style, text, value);
  });
  return text;
}


/**
* The method returns markup for section to which inline styles
like color, background-color, font-size are applicable.
*/
function getInlineStyleSectionMarkup(block: Object, styleSection: Object): string {
  const styleTagSections = getInlineStyleSections(
    block, ['BOLD', 'ITALIC', 'UNDERLINE'], styleSection.start, styleSection.end
  );
  let styleTagSectionText = '';
  styleTagSections.forEach((styleTagSection) => {
    styleTagSectionText += getStyleTagSectionMarkup(styleTagSection);
  });
  styleTagSectionText = addStylePropertyMarkup(styleSection.styles, styleTagSectionText);
  return styleTagSectionText;
}

/**
* The method returns markup for an entity section.
* An entity section is a continuous section in a block
* to which same entity or no entity is applicable.
*/
function getEntitySectionMarkup(block: Object, entityMap: Object, entitySection: Object): string {
  const entitySectionMarkup = [];
  const inlineStyleSections = getInlineStyleSections(
    block, ['COLOR', 'FONTSIZE', 'FONTFAMILY'], entitySection.start, entitySection.end
  );
  inlineStyleSections.forEach((styleSection) => {
    entitySectionMarkup.push(getInlineStyleSectionMarkup(block, styleSection));
  });
  let sectionText = entitySectionMarkup.join('');
  if (entitySection.entityKey !== undefined && entitySection.entityKey !== null) {
    sectionText = getEntityMarkup(entityMap, entitySection.entityKey, sectionText);
  }
  return sectionText;
}

/**
* Function will return the markup for block preserving the inline styles and
* special characters like newlines or blank spaces.
*/
export function getBlockInnerMarkup(block: Object, entityMap: Object): string {
  const blockMarkup = [];
  if (isAtomicEntityBlock(block)) {
    const entityMarkup = getEntityMarkup(entityMap, block.entityRanges[0].key);
    if (entityMarkup) {
      blockMarkup.push(entityMarkup);
    }
  } else {
    const entitySections = getEntitySections(block.entityRanges, block.text.length);
    entitySections.forEach((section, index) => {
      let sectionText = getEntitySectionMarkup(block, entityMap, section);
      if (index === 0) {
        sectionText = trimLeadingZeros(sectionText);
      }
      if (index === entitySections.length - 1) {
        sectionText = trimTrailingZeros(sectionText);
      }
      blockMarkup.push(sectionText);
    });
  }
  return blockMarkup.join('');
}

/**
* Function will return html for the block.
*/
export function getBlockMarkup(block: Object, entityMap: Object): string {
  const blockHtml = [];
  const blockTag = getBlockTag(block.type);
  if (blockTag) {
    blockHtml.push(`<${blockTag}>`);
  }
  blockHtml.push(getBlockInnerMarkup(block, entityMap));
  if (blockTag) {
    blockHtml.push(`</${blockTag}>`);
  }
  blockHtml.push('\n');
  return blockHtml.join('');
}
