"use client";

import { useEffect, useRef } from "react";
import { indentWithTab } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { FiHelperText } from "./Fields";

/**
 * Filament's CodeEditor (CodeMirror 6 with its basic setup, Tab indenting) for HTML,
 * as resources/js/components/code-editor.js builds it.
 */
export function FiCodeEditor({ id, label, helper, initial, disabled = false, onChange }: { id: string; label: string; helper?: string; initial: string; disabled?: boolean; onChange: (value: string) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const view = new EditorView({
      parent: mount.current!,
      state: EditorState.create({
        doc: initial,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          EditorView.contentAttributes.of({ "aria-label": label, ...(helper ? { "aria-describedby": `${id}-helper-text` } : {}) }),
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          html(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    });

    return () => view.destroy();
    // built once; CodeMirror then owns the text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-field-wrapper="" className="fi-fo-field">
      <div id={`${id}-label`} className="fi-fo-field-label fi-sr-only">
        {label}
      </div>
      <div className="fi-fo-field-content-col">
        <div className={`fi-fo-code-editor fi-input-wrp${disabled ? " fi-disabled" : ""}`}>
          <div className="fi-input-wrp-content-ctn">
            <div aria-labelledby={`${id}-label`} id={id} role="group">
              <div ref={mount} />
            </div>
          </div>
        </div>
        {helper ? <FiHelperText id={id} text={helper} /> : null}
      </div>
    </div>
  );
}
