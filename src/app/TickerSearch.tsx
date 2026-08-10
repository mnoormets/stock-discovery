export default function TickerSearch({ initialValue = '' }: { initialValue?: string }) {
  return (
    <form className="search" action="/search" method="get">
      <label htmlFor="ticker">Otsi ettevõtet tickeri järgi</label>
      <div className="searchRow">
        <input
          id="ticker"
          name="ticker"
          defaultValue={initialValue}
          placeholder="Näiteks AAPL, NVDA, RKLB või ASTS"
          maxLength={10}
          autoCapitalize="characters"
          required
        />
        <button className="primary" type="submit">Otsi</button>
      </div>
    </form>
  );
}
