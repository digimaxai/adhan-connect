const DEFAULT_PAGE_SIZE = 1000;

type FetchAllMosqueRowsOptions = {
  orderBy?: string;
  ascending?: boolean;
  pageSize?: number;
};

type FetchAllMosqueRowsResult<T> = {
  data: T[];
  error: { message?: string } | null;
};

export async function fetchAllMosqueRows<T>(
  supabaseClient: any,
  selectColumns: string,
  options: FetchAllMosqueRowsOptions = {}
): Promise<FetchAllMosqueRowsResult<T>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const orderBy = options.orderBy ?? 'name';
  const ascending = options.ascending ?? true;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseClient
      .from('mosques')
      .select(selectColumns)
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1);

    if (error) return { data: rows, error };

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}
