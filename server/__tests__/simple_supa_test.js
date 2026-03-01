const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient('https://xyz.supabase.co', 'fake-key');
  try {
    const res = supabase.from('messages').insert({ content: 'test' });
    console.log('Result type:', typeof res);
    console.log('Result has catch:', typeof res.catch);

    const promise = res.then(x => x);
    console.log('Promise has catch:', typeof promise.catch);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
