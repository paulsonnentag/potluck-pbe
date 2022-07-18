import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { Facet, StateEffect, StateField } from "@codemirror/state";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { autorun, comparer, computed, reaction, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import {
  getSheetConfigsOfTextDocument,
  Highlight,
  SheetConfig,
  sheetConfigsMobx,
  textDocumentsMobx,
  textEditorStateMobx,
} from "./primitives";
import { evaluateSheetConfigs } from "./formulas";

const textDocumentIdFacet = Facet.define<string, string>({
  combine: (values) => values[0],
});

const setHighlightsEffect = StateEffect.define<Highlight[]>();
const highlightsField = StateField.define<Highlight[]>({
  create() {
    return [];
  },
  update(snippets, tr) {
    for (let e of tr.effects) {
      if (e.is(setHighlightsEffect)) {
        return e.value;
      }
    }
    return snippets
      .map((highlight) => ({
        ...highlight,
        span: [
          tr.changes.mapPos(highlight.span[0]),
          tr.changes.mapPos(highlight.span[1]),
        ],
      }))
      .filter(
        (highlight) => highlight.span[0] !== highlight.span[1]
      ) as Highlight[];
  },
});

const snippetDecorations = EditorView.decorations.compute(
  [highlightsField],
  (state) => {
    return Decoration.set(
      state.field(highlightsField).map((snippet) => {
        return Decoration.mark({
          class: "bg-yellow-100 rounded",
        }).range(snippet.span[0], snippet.span[1]);
      }),
      true
    );
  }
);

export let EDITOR_VIEW: EditorView;

export const Editor = observer(
  ({ textDocumentId }: { textDocumentId: string }) => {
    const editorRef = useRef(null);
    const textDocument = textDocumentsMobx.get(textDocumentId)!;

    useEffect(() => {
      const view = (EDITOR_VIEW = new EditorView({
        doc: textDocument.text,
        extensions: [
          minimalSetup,
          EditorView.theme({
            "&": {
              height: "100%",
            },
          }),
          EditorView.lineWrapping,
          highlightsField,
          snippetDecorations,
          textDocumentIdFacet.of(textDocumentId),
        ],
        parent: editorRef.current!,
        dispatch(transaction) {
          view.update([transaction]);

          runInAction(() => {
            textDocument.text = view.state.doc;
            textEditorStateMobx.set(transaction.state);
          });
        },
      }));

      runInAction(() => {
        textEditorStateMobx.set(view.state);
      });

      const unsubscribes: (() => void)[] = [
        autorun(() => {
          const highlights = computed(
            () => {
              const sheetConfigs: SheetConfig[] =
                getSheetConfigsOfTextDocument(textDocument);
              const documentValueRows = evaluateSheetConfigs(
                textDocument,
                sheetConfigs
              );
              return Object.values(documentValueRows)
                .map((sheetValueRows) =>
                  sheetValueRows.filter(
                    (r): r is Highlight => "span" in r && r.span !== undefined
                  )
                )
                .flat();
            },
            { equals: comparer.structural }
          ).get();
          view.dispatch({
            effects: setHighlightsEffect.of(highlights),
          });
        }),
      ];

      return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
        view.destroy();
      };
    }, [textDocumentId]);

    return (
      <div
        className="text-lg h-[500px] w-[500px] bg-white border-black border-2 rounded-lg overflow-auto flex-shrink-0"
        ref={editorRef}
      />
    );
  }
);
