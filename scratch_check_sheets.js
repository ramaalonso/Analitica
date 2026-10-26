async function main() {
  const gid = '1990667304';
  const url = `https://docs.google.com/spreadsheets/d/15hjl5YFZqSFRGuh1IEv7zHDRXrQPPfvRU8dijVOmWPY/export?format=csv&gid=${gid}&t=${Date.now()}`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.split('\n');
  console.log('Total lines in Stock myb:', lines.length);
  lines.forEach((line, i) => {
    if (line.trim()) console.log(`${i}: ${line.trim()}`);
  });
}

main().catch(console.error);
