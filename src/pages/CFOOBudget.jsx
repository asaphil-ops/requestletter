import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fmtCurrency } from '../lib/utils';

/**
 * CFOO Budget page – loads the same CSV used for the generic Budget page
 * and displays it in a premium‑styled table. Clicking a row opens a modal
 * that shows all fields for the selected record.
 */
export default function CFOOBudget() {
  const [data, setData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null); // row object
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  // Palitan ang fetch logic: Mula CSV patungo sa Supabase Database
  useEffect(() => {
    async function fetchBudget() {
      try {
        setLoading(true);
        const { data: dbData, error: dbError } = await supabase
          .from('cfoo_budget')
          .select('*');

        if (dbError) throw dbError;

        if (dbData && dbData.length > 0) {
          // Kunin ang mga columns mula sa database pero wag isama ang 'id' at 'created_at'
          const dbHeaders = Object.keys(dbData[0]).filter(k => !['id', 'created_at'].includes(k));
          setHeaders(dbHeaders);
          setData(dbData);
        }
      } catch (err) {
        console.error('Error fetching budget:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBudget();
  }, []);

  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paginatedData = data.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const goPrev = () => setCurrentPage(p => Math.max(p - 1, 1));
  const goNext = () => setCurrentPage(p => Math.min(p + 1, totalPages));

  if (loading) return <div className="p-6 text-white">Loading CFOO Budget...</div>;
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;

  if (data.length === 0) return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">CFOO Budget Overview</h1>
      <div className="bg-[#0e1a2a] p-10 rounded-lg text-center">
        <i className="fas fa-database text-4xl text-gray-600 mb-4 block" />
        <p className="text-gray-400 mb-6">Walang nahanap na records sa database.</p>
        <button 
          onClick={() => navigate('/bulk-upload')}
          className="btn-primary px-6 py-2"
        >
          Mag-upload ng Data
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-gradient-to-b from-[#0b1420] to-[#111d2e] text-white">
      <h1 className="text-2xl font-bold mb-4">CFOO Budget Overview</h1>
      <div className="overflow-x-auto rounded-lg shadow-lg bg-[#0e1a2a]">
        <table className="w-full min-w-[1600px] table-fixed border-collapse">
          <thead className="bg-[#1b2b40] text-left">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2 text-sm font-medium uppercase tracking-wider whitespace-nowrap">
                  {h.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => (
              <tr
                key={idx}
                className="cursor-pointer hover:bg-[#1e2e45] transition-colors"
                onClick={() => setSelected(row)}
              >
                {headers.map((h) => {
                  const val = row[h] || '';
                  const head = h.toLowerCase();
                  
                  // Listahan ng mga numeric columns based sa input mo
                  const isNumeric = [
                    'budget', 
                    'transfer_to_field_ops', 
                    'sbar', 
                    'actual',
                    'remaining_budget'
                  ].includes(head);
                  
                  const isStaff = head === 'staff_name';

                  return (
                  <td key={h} className="px-4 py-2 text-sm border-t border-[#2a3a55] truncate" title={String(val)}>
                    {isNumeric && val !== '' ? (
                      <span className="font-mono text-emerald-400">{fmtCurrency(val)}</span>
                    ) : (() => {
                      const fix = str => String(str || '').replace(/Ã±/g, 'ñ').replace(/Ã‘/g, 'Ñ').replace(/([A-Z])\ufffd/g, '$1Ñ').replace(/\ufffd/g, 'ñ').split(String.fromCharCode(65533)).join('ñ').replace(/DASMARIñAS/gi, 'DASMARIÑAS').replace(/LAS PIñAS/gi, 'LAS PIÑAS').replace(/PARAñAQUE/gi, 'PARAÑAQUE')
                      const fixedVal = fix(val)
                      return isStaff ? (
                        <span className="font-bold text-white">{fixedVal}</span>
                      ) : (
                        fixedVal
                      )
                    })()}
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex justify-center items-center mt-4 space-x-4">
        <button
          onClick={goPrev}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-[#254662] hover:bg-[#2e5a80] text-white rounded disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm">Page {currentPage} of {totalPages}</span>
        <button
          onClick={goNext}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-[#254662] hover:bg-[#2e5a80] text-white rounded disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1b2b40] rounded-lg w-11/12 max-w-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Record Details</h2>
              <button className="text-gray-400 hover:text-white" onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {headers.map((h) => (
                <React.Fragment key={h}>
                  <div className="font-medium text-gray-300">{h}</div>
                  <div className="text-gray-100 break-words">{selected[h]}</div>
                </React.Fragment>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button className="px-4 py-2 bg-[#254662] hover:bg-[#2e5a80] text-white rounded" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
