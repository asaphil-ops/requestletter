import { useEffect, useState } from 'react';

// Helper to parse CSV text into an array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    // split respecting quoted commas
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    return obj;
  });
  return rows;
}

export default function BudgetPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Assumes the CSV file is placed in the public folder as budget.csv
    fetch('/budget.csv')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch CSV');
        return res.text();
      })
      .then(text => {
        const rows = parseCSV(text);
        setData(rows);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Loading budget data...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  if (data.length === 0) return <div className="p-4">No budget data available.</div>;

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="p-4 overflow-x-auto">
      <h1 className="text-2xl font-bold mb-4">CFOO Budget Overview</h1>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            {headers.map(h => (
              <th key={h} className="border px-3 py-2 text-left text-sm font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
              {headers.map(h => (
                <td key={h} className="border px-3 py-2 text-sm">
                  {row[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
