from fastapi import APIRouter

from database.repository import repository

router = APIRouter(
    prefix="/faults",
    tags=["Faults"],
)

@router.get("/latest")
def get_latest_fault():

    fault = repository.get_latest_fault()

    if fault is None:
        return {
            "fault_detected": False,
            "subsystem": "none",
            "severity": "normal",
        }

    return {
        "fault_detected": True,
        **fault,
    }