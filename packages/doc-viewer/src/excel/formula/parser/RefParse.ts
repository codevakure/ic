import {parseRange} from '../../io/excel/util/Range';
import {Parser} from '../Parser';
import {ASTNode} from '../ast/ASTNode';
import {Reference} from '../ast/Reference';
import {Token} from '../tokenizer';
import {PrefixParse} from './PrefixParse';
import {removeQuote} from './remoteQuote';
import {tokenIsRef} from './tokenIsRef';

function nextIsRef(parser: Parser) {
  const nextToken = parser.peakNext();
  return tokenIsRef(nextToken);
}

export class RefParse implements PrefixParse {
  parse(parser: Parser, token: Token): ASTNode {
    let sheetName;

    if (token.name === 'OPEN_BRACKET') {
      token = parser.next();
      // [comment removed]
      while (token && token.name !== 'CLOSE_BRACKET') {
        token = parser.next();
      }
      token = parser.next();
    }

    if (token.name === 'SHEET') {
      sheetName = token.value.replace(/!$/, '');
      token = parser.next();
    }

    if (token.name === 'SHEET_QUOTE') {
      sheetName = removeQuote(token.value.replace(/!$/, ''));
      token = parser.next();
    }

    let ref: Reference | null = null;

    if (token.name === 'NAME') {
      // [comment removed]
      if (token.value.match(/^[A-Z]{1,3}$/)) {
        const nextToken = parser.peakNext();
        if (nextToken && nextToken.name === 'COLON') {
          const start = token.value;
          parser.next();
          const end = parser.next('NAME').value;
          const rangeRef = parseRange((start + ':' + end).replace('/$/g', ''));
          token.value = start + ':' + end;
          ref = {
            sheetName,
            start,
            end,
            range: rangeRef
          };
        } else {
          const col = token.value;
          const rangeRef = parseRange(col.replace('/$/g', ''));
          ref = {
            sheetName,
            start: col,
            end: col,
            range: rangeRef
          };
        }
      } else {
        ref = {
          sheetName,
          name: token.value
        };
      }
    }

    if (token.name === 'CELL') {
      // [comment removed]
      const nextToken = parser.peakNext();
      if (nextToken && nextToken.name === 'COLON') {
        const start = token.value;
        parser.next();
        let end = parser.next().value;
        // [comment removed]
        if (end.startsWith("'")) {
          // [comment removed]
          end = parser.next().value;
        }
        const rangeRef = parseRange((start + ':' + end).replace('/$/g', ''));
        token.value = start + ':' + end;
        ref = {
          sheetName,
          start,
          end,
          range: rangeRef
        };
      } else if (!nextIsRef(parser)) {
        const start = token.value;
        try {
          const rangeRef = parseRange(start.replace('/$/g', ''));
          ref = {
            sheetName,
            start,
            end: start,
            range: rangeRef
          };
        } catch (error) {
          // [comment removed]
          ref = {
            sheetName,
            name: token.value
          };
        }
      }
    }

    if (!ref) {
      // [comment removed]
      return {
        type: 'Constant',
        token,
        children: []
      };
    }

    // [comment removed]
    if (nextIsRef(parser)) {
      const refs = [ref];
      do {
        const next = parser.parseFormula();
        token.value += ' ' + next.token.value;
        refs.push(next.ref!);
      } while (parser.match('SHEET', 'SHEET_QUOTE', 'CELL', 'NAME'));
      return {
        type: 'Intersection',
        token,
        children: [],
        refs
      };
    }

    return {
      type: 'Reference',
      token,
      children: [],
      ref
    };
  }
}
