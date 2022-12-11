import { TypeFactory, TypeKind } from '@fivetrandevelopers/zetasql';
import { ParseLocationRangeProto__Output } from '@fivetrandevelopers/zetasql/lib/types/zetasql/ParseLocationRangeProto';
import { SimpleColumnProto } from '@fivetrandevelopers/zetasql/lib/types/zetasql/SimpleColumnProto';
import { StructFieldProto } from '@fivetrandevelopers/zetasql/lib/types/zetasql/StructFieldProto';
import { TypeProto } from '@fivetrandevelopers/zetasql/lib/types/zetasql/TypeProto';
import { ColumnDefinition } from '../TableDefinition';

interface Node {
  node: string;
  [key: string]: unknown;
}

export function positionInRange(position: number, range: ParseLocationRangeProto__Output): boolean {
  return range.start <= position && position <= range.end;
}

export function rangeContainsRange(outerRange: ParseLocationRangeProto__Output, innerRange: ParseLocationRangeProto__Output): boolean {
  return outerRange.start <= innerRange.start && innerRange.end <= outerRange.end;
}

export function rangesEqual(range1: ParseLocationRangeProto__Output, range2: ParseLocationRangeProto__Output): boolean {
  return range1.start === range2.start && range1.end === range2.end;
}

// TODO: add unit tests
export function createType(newColumn: ColumnDefinition): TypeProto {
  const bigQueryType = newColumn.type.toLowerCase();
  const typeKind = TypeFactory.SIMPLE_TYPE_KIND_NAMES.get(bigQueryType);
  let resultType: TypeProto;
  if (typeKind) {
    resultType = {
      typeKind,
    };
  } else if (bigQueryType === 'record') {
    resultType = {
      typeKind: TypeKind.TYPE_STRUCT,
      structType: {
        field: newColumn.fields?.map<StructFieldProto>(f => ({
          fieldName: f.name,
          fieldType: createType(f),
        })),
      },
    };
  } else {
    console.log(`Cannot find TypeKind for ${newColumn.type}`); // TODO: fix all these issues
    resultType = {
      typeKind: TypeKind.TYPE_STRING,
    };
  }
  if (newColumn.mode?.toLocaleLowerCase() === 'repeated') {
    resultType = {
      typeKind: TypeKind.TYPE_ARRAY,
      arrayType: {
        elementType: resultType,
      },
    };
  }
  return resultType;
}

export function traverse<T>(nodeType: string, unknownNode: unknown, action: (node: T) => void): void {
  const node = unknownNode as Node;
  if (node.node === nodeType) {
    const typedNode = node[node.node] as T;
    action(typedNode);
  }
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (typeof child === 'object' && child !== null) {
      traverse(nodeType, child, action);
    }
  }
}

export function createSimpleColumn(name: string, type: TypeProto | null): SimpleColumnProto {
  return { name, type };
}
