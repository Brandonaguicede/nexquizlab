import { questionInput, quizInput, validateOrder } from '../src/domain/quiz';
describe('authoring domain invariants', () => {
 it('normalizes quiz text and optional description', () => expect(quizInput({ title: '  Ciencias  ' })).toEqual({ title: 'Ciencias', description: '' }));
 it.each(['', '  ', 'x'.repeat(161)])('rejects invalid quiz titles', title => expect(() => quizInput({ title })).toThrow());
 it('rejects long descriptions', () => expect(() => quizInput({ title: 'Quiz', description: 'x'.repeat(2001) })).toThrow());
 it('accepts false without coercion', () => expect(questionInput({ prompt: ' Tierra ', correctAnswer: false })).toEqual({ prompt: 'Tierra', correctAnswer: false }));
 it.each(['', ' ', 'x'.repeat(2001)])('rejects invalid prompts', prompt => expect(() => questionInput({ prompt, correctAnswer: true })).toThrow());
 it('accepts a complete permutation', () => expect(() => validateOrder(['b','a'], ['a','b'])).not.toThrow());
 it.each([['a','a'], ['a'], ['a','c'], ['a','b','c']])('rejects incomplete, duplicate or stale permutations %j', (...ids) => expect(() => validateOrder(ids, ['a','b'])).toThrow());
});
