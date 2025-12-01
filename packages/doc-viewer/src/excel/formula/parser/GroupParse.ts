import {Parser} from '../Parser';
import {ASTNode} from '../ast/ASTNode';
import {Token} from '../tokenizer';
import {PrefixParse} from './PrefixParse';

export class GroupParse implements PrefixParse {
  parse(parser: Parser, token: Token): ASTNode {
    const child = parser.parseFormula();
    const nextToken = parser.peakNext();
    // [comment removed]
    if (nextToken && nextToken.name === 'COMMA') {
      const array = [child];
      parser.next();
      do {
        const token = parser.peakNext();
        // [comment removed]
        if (token && token.name === 'CLOSE_PAREN') {
          break;
        }
        array.push(parser.parseFormula());
      } while (parser.match('COMMA'));
      parser.next('CLOSE_PAREN');
      return {
        type: 'Union',
        token,
        children: array
      };
    } else {
      parser.next('CLOSE_PAREN');
      return child;
    }
  }
}
