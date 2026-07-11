import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/monaco-shim', () => {
  const editor = {
    EditorOption: {
      lineHeight: 'lineHeight',
    },
  }
  return {
    default: { editor },
    editor,
  }
})

import {
  computeDiffHeight,
  computeDiffRawHeight,
  hasVerticalScrollbar,
  isUserNearBottom,
  revealEditorLine,
} from '../src/core/diffViewport'

function createCodeEditor(lineCount: number, scrollHeight: number, lineHeight = 20, contentHeight = scrollHeight) {
  return {
    getModel() {
      return {
        getLineCount() {
          return lineCount
        },
      }
    },
    getOption() {
      return lineHeight
    },
    getScrollHeight() {
      return scrollHeight
    },
    getContentHeight() {
      return contentHeight
    },
    revealLine: vi.fn(),
    revealLineInCenter: vi.fn(),
    revealLineInCenterIfOutsideViewport: vi.fn(),
  }
}

describe('diffViewport helpers', () => {
  it('computeDiffRawHeight prefers rendered scroll height and clamps to max', () => {
    const originalEditor = createCodeEditor(3, 140)
    const modifiedEditor = createCodeEditor(5, 220)
    const diffEditorView = {
      getOriginalEditor() {
        return originalEditor as any
      },
      getModifiedEditor() {
        return modifiedEditor as any
      },
    } as any

    expect(computeDiffRawHeight({ diffEditorView, maxHeightValue: 180 })).toBe(180)
    expect(computeDiffRawHeight({ diffEditorView, maxHeightValue: 260 })).toBe(220)
  })

  it('computeDiffRawHeight respects explicit zero editor padding', () => {
    const originalEditor = createCodeEditor(5, 150, 20, 100)
    const modifiedEditor = createCodeEditor(5, 150, 20, 100)
    const diffEditorView = {
      getOriginalEditor() {
        return originalEditor as any
      },
      getModifiedEditor() {
        return modifiedEditor as any
      },
    } as any

    expect(computeDiffRawHeight({
      diffEditorView,
      editorPadding: { top: 0, bottom: 0 },
      maxHeightValue: 260,
    })).toBe(100)
  })

  it('computeDiffHeight preserves inline streaming floor', () => {
    expect(
      computeDiffHeight({
        rawHeight: 120,
        isInlineMode: true,
        inlineDiffStreamingPresentationActive: true,
        inlineDiffStreamingHeightFloor: 180,
      }),
    ).toEqual({
      height: 180,
      nextInlineDiffStreamingHeightFloor: 180,
    })
  })

  it('viewport helpers detect scroll state consistently', () => {
    expect(
      hasVerticalScrollbar({
        computedHeight: 100,
        lineHeight: 20,
        scrollHeight: 130,
      }),
    ).toBe(true)

    expect(
      isUserNearBottom(
        {
          computedHeight: 100,
          lineHeight: 20,
          scrollHeight: 200,
          scrollTop: 120,
          viewportHeight: 40,
        },
        {
          autoScrollThresholdLines: 2,
          autoScrollThresholdPx: 8,
        },
      ),
    ).toBe(true)
  })

  it('revealEditorLine dispatches to the requested reveal strategy', () => {
    const editor = createCodeEditor(5, 120)

    revealEditorLine(editor as any, 4, 'centerIfOutside', 1)
    revealEditorLine(editor as any, 5, 'center')
    revealEditorLine(editor as any, 6, 'bottom')

    expect(editor.revealLineInCenterIfOutsideViewport).toHaveBeenCalledWith(4, 1)
    expect(editor.revealLineInCenter).toHaveBeenCalledWith(5)
    expect(editor.revealLine).toHaveBeenCalledWith(6)
  })
})
