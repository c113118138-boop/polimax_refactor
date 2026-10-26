"""Validate explicit detail links; omitted links keep the existing row-order fallback."""
from fastapi import HTTPException

def detail_links(content, kind):
    if kind == 'D':
        return
    details = content.get('details', [])
    for row, slot in enumerate(content.get('slots', [])):
        value = slot.get('detail_index', min(row, max(0, len(details)-1)))
        try:
            index = int(value)
            if isinstance(value, bool) or isinstance(value, float) and value != index or not 0 <= index < len(details):
                raise ValueError()
        except (ValueError, TypeError, OverflowError):
            raise HTTPException(422, '借用時段須對應有效需求明細')
        slot['detail_index'] = index
