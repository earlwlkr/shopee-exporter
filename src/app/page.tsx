'use client';

import { useState } from 'react';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export default function Home() {
  const [partnerId, setPartnerId] = useState('');
  const [partnerKey, setPartnerKey] = useState('');
  const [shopId, setShopId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [env, setEnv] = useState<'test' | 'live'>('test');
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState('');

  async function handleExport() {
    setError('');
    setLog('');
    if (!partnerId || !partnerKey || !shopId || !accessToken) {
      setError('Please fill in all configuration fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, partnerKey, shopId, accessToken, env, dateFrom, dateTo }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shopee-orders-${dateFrom}-to-${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setLog('Export completed successfully.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold text-orange-600 mb-2">Shopee Order Exporter</h1>
      <p className="text-sm text-gray-500 mb-8">Export order data via Shopee Open API v2.0 as a CSV file.</p>

      <section className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Merchant Configuration</h2>

        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Partner ID
            <input
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="e.g. 1234567"
              value={partnerId}
              onChange={e => setPartnerId(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Partner Key
            <input
              type="password"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Your partner secret key"
              value={partnerKey}
              onChange={e => setPartnerKey(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Shop ID
            <input
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="e.g. 7654321"
              value={shopId}
              onChange={e => setShopId(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Access Token
            <input
              type="password"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="OAuth access token"
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-1 text-sm font-medium">
            Environment
            <div className="flex gap-3 mt-1">
              {(['test', 'live'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    env === e
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                  }`}
                >
                  {e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Date Range</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            To
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {log && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {log}
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={loading}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl py-3 transition-colors text-base"
      >
        {loading ? 'Exporting…' : 'Export to CSV'}
      </button>
    </main>
  );
}
