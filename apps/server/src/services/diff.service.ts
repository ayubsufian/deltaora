import * as Diff from 'diff';
import { calculateChangeScore } from '@deltaora/shared-utils';

export interface DiffResult {
  addedText: string;
  removedText: string;
  changeScore: number;
}

export const generateDiff = (oldText: string, newText: string): DiffResult => {
  const diffs = Diff.diffWords(oldText, newText);

  let addedText = '';
  let removedText = '';
  let addedLength = 0;
  let removedLength = 0;

  diffs.forEach(part => {
    if (part.added) {
      addedText += part.value + '\n';
      addedLength += part.value.length;
    } else if (part.removed) {
      removedText += part.value + '\n';
      removedLength += part.value.length;
    }
  });

  const totalLength = Math.max(oldText.length, newText.length);
  const changeScore = calculateChangeScore(addedLength, removedLength, totalLength);

  return {
    addedText: addedText.trim(),
    removedText: removedText.trim(),
    changeScore
  };
};
