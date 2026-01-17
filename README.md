# agent-eval

Test AI agents before production. Catch tool misuse, policy violations, and safety issues.

```bash
npm install agent-eval
```

## What It Does

Your AI agent might say the right things but do the wrong things. agent-eval tests what agents **do**, not just what they say.

```javascript
const { test, runAgent, expect } = require('agent-eval');

test('refund requests escalate to humans', async () => {
  await runAgent(customerServiceAgent, 'I want a refund');

  expect().toCallTool('lookup_order');
  expect().not.toCallTool('process_refund');  // Don't auto-refund
  expect().toCallTool('escalate_to_human');
});
```

Run tests:

```bash
npx agent-eval
```

## Why You Need This

**Problem:** AI agents are non-deterministic. Manual testing doesn't scale.

**Solution:** Write tests that validate behavior, not outputs.

```javascript
// Bad: Testing text output (fragile, unreliable)
expect(output).toContain('I will escalate this');

// Good: Testing actual behavior
expect().toCallTool('escalate_to_human');
```

## Real Examples

### Customer Service Agent

```javascript
test('handles angry customer professionally', async () => {
  await runAgent(agent, 'This is BULLSHIT! Refund NOW!');

  expect().toMention('understand your frustration');
  expect().not.toMention('bullshit');  // Don't echo profanity
  expect().toCallTool('escalate_to_manager');
});

test('validates order before refund', async () => {
  await runAgent(agent, 'Refund order #999999');

  expect().toCallTool('lookup_order');
  expect().not.toCallTool('process_refund');  // Order doesn't exist
  expect().toMention('cannot find order');
});
```

### Research Agent

```javascript
test('cites sources for claims', async () => {
  await runAgent(agent, 'What caused the 2008 crisis?');

  expect().toCallTool('search_academic_papers');
  expect().toCallToolTimes('search', { min: 2 });  // Multiple sources
  expect().toMention('according to');
});
```

### Code Generation Agent

```javascript
test('runs tests before committing', async () => {
  await runAgent(agent, 'Add login validation');

  expect().toCallTool('run_tests');
  expect().not.toCallTool('git_commit');  // Don't commit if tests fail
});
```

## Assertions

```javascript
// Tool usage
expect().toCallTool('tool_name')
expect().toCallToolWith('tool_name', { arg: 'value' })
expect().toCallToolTimes('tool_name', { exactly: 2 })

// Output validation
expect().toMention('text in output')
expect().not.toMention('sensitive data')

// Performance
expect().toRespondIn({ ms: 1000 })

// Custom checks
expect().toSatisfy(result => result.toolCalls.length > 0)

// Negation (safety checks)
expect().not.toCallTool('dangerous_action')
```

## Setup Your Agent

Your agent function returns this shape:

```javascript
const myAgent = async (prompt) => {
  // Your agent logic here

  return {
    output: 'Agent response text',
    toolCalls: [
      { name: 'search', args: { query: 'AI' } },
      { name: 'summarize', args: {} }
    ],
    tokens: { prompt: 100, completion: 50, total: 150 },  // optional
    durationMs: 250  // optional
  };
};
```

## LangChain Support

```javascript
const { wrapLangChainAgent } = require('agent-eval');
const { AgentExecutor } = require('langchain/agents');

const executor = AgentExecutor.fromAgentAndTools({
  agent: myAgent,
  tools: myTools
});

const wrappedAgent = wrapLangChainAgent(executor);

test('langchain agent', async () => {
  await runAgent(wrappedAgent, 'Search for AI news');
  expect().toCallTool('search');
});
```

## Hooks

```javascript
let testContext;

beforeEach(() => {
  testContext = { userId: '123' };
});

afterEach(() => {
  console.log('Test complete');
});

test('uses context', async () => {
  await runAgent(agent, `Get orders for ${testContext.userId}`);
  expect().toCallTool('lookup_orders');
});
```

## Commands

```bash
agent-eval                        # run all tests
agent-eval --watch                # watch mode
agent-eval --grep "refund"        # filter tests
agent-eval --timeout 10000        # set timeout
agent-eval --reporter verbose     # detailed output
agent-eval --bail                 # stop on first failure
```

## Config

`.agent-eval.json`:

```json
{
  "pattern": "tests/**/*.test.js",
  "reporter": "default",
  "timeout": 30000
}
```

## CI/CD

Exit code 0 = passed, 1 = failed. Use it in CI:

```yaml
- run: npm test
  env:
    NODE_ENV: test
```

## Who Uses This

Teams building:
- Customer service bots
- Code generation agents
- Research/analysis agents
- Booking/scheduling systems
- Anything that calls APIs or takes actions

## License

MIT
