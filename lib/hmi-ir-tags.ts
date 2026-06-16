export interface HmiTag {
  name: string;
  address: string;
  type: string;
  comment: string;
}

/** Extract HMI tag rows from a saved PLC program IR (`generation_parameters.ir`). */
export function extractTagsFromProgramIr(ir: unknown): HmiTag[] {
  if (!ir || typeof ir !== 'object') return [];
  const vars = (ir as { vars?: unknown }).vars;
  if (!Array.isArray(vars)) return [];

  return vars
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && typeof (item as { symbol?: unknown }).symbol === 'string',
    )
    .map((item) => ({
      name: String(item.symbol),
      address: item.address != null ? String(item.address) : '',
      type: item.dataType != null ? String(item.dataType) : 'BOOL',
      comment: item.comment != null ? String(item.comment) : item.kind != null ? String(item.kind) : '',
    }));
}
