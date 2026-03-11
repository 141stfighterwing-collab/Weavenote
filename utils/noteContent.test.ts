import { test } from 'node:test';
import assert from 'node:assert';
import { toggleTaskCheckboxAtIndex } from './noteContent.ts';

test('toggleTaskCheckboxAtIndex - Happy Path: Toggle unchecked to checked', () => {
  const content = '- [ ] Task 1';
  const expected = '- [x] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, 0);
  assert.strictEqual(result, expected);
});

test('toggleTaskCheckboxAtIndex - Happy Path: Toggle checked to unchecked', () => {
  const content = '- [x] Task 1';
  const expected = '- [ ] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, 0);
  assert.strictEqual(result, expected);
});

test('toggleTaskCheckboxAtIndex - Happy Path: Case-insensitive toggle checked to unchecked', () => {
  const content = '- [X] Task 1';
  const expected = '- [ ] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, 0);
  assert.strictEqual(result, expected);
});

test('toggleTaskCheckboxAtIndex - Happy Path: Target correct index in multi-line content', () => {
  const content = '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3';

  // Toggle first
  assert.strictEqual(toggleTaskCheckboxAtIndex(content, 0), '- [x] Task 1\n- [ ] Task 2\n- [ ] Task 3');

  // Toggle second
  assert.strictEqual(toggleTaskCheckboxAtIndex(content, 1), '- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3');

  // Toggle third
  assert.strictEqual(toggleTaskCheckboxAtIndex(content, 2), '- [ ] Task 1\n- [ ] Task 2\n- [x] Task 3');
});

test('toggleTaskCheckboxAtIndex - Happy Path: Support different list markers', () => {
  assert.strictEqual(toggleTaskCheckboxAtIndex('* [ ] Star', 0), '* [x] Star');
  assert.strictEqual(toggleTaskCheckboxAtIndex('+ [ ] Plus', 0), '+ [x] Plus');
  assert.strictEqual(toggleTaskCheckboxAtIndex('1. [ ] Numbered', 0), '1. [x] Numbered');
});

test('toggleTaskCheckboxAtIndex - Edge Case: Leading spaces', () => {
  const content = '  - [ ] Indented task';
  const expected = '  - [x] Indented task';
  const result = toggleTaskCheckboxAtIndex(content, 0);
  assert.strictEqual(result, expected);
});

test('toggleTaskCheckboxAtIndex - Edge Case: No checkboxes in content', () => {
  const content = 'Just some text without checkboxes.';
  const result = toggleTaskCheckboxAtIndex(content, 0);
  assert.strictEqual(result, null);
});

test('toggleTaskCheckboxAtIndex - Edge Case: Index out of bounds', () => {
  const content = '- [ ] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, 1);
  assert.strictEqual(result, null);
});

test('toggleTaskCheckboxAtIndex - Validation: Non-string content', () => {
  const result = toggleTaskCheckboxAtIndex(null as any, 0);
  assert.strictEqual(result, null);
});

test('toggleTaskCheckboxAtIndex - Validation: Non-integer index', () => {
  const content = '- [ ] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, 1.5);
  assert.strictEqual(result, null);
});

test('toggleTaskCheckboxAtIndex - Validation: Negative index', () => {
  const content = '- [ ] Task 1';
  const result = toggleTaskCheckboxAtIndex(content, -1);
  assert.strictEqual(result, null);
});
