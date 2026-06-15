from fastapi import APIRouter, Depends

from plc_file_handler.utils import get_supported_formats

from ..dependencies import verify_api_key

router = APIRouter(prefix="/v1/formats", tags=["formats"], dependencies=[Depends(verify_api_key)])


@router.get("")
async def list_formats():
    return {"formats": get_supported_formats()}
