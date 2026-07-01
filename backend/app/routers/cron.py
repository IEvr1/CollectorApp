from fastapi import APIRouter, Depends, Query

from app.deps import DbDep, verify_cron_secret
from app.services.payout import PayoutService

router = APIRouter(prefix="/cron", tags=["cron"])


@router.get("/weekly-payout")
def cron_weekly_payout(
    db: DbDep,
    _: None = Depends(verify_cron_secret),
    force: bool = Query(False, description="Run even if today is not Friday"),
    dry_run: bool = Query(False, description="Report payouts without executing transfers"),
):
    """Friday batch: transfer collected funds from Revolut to each building's committee BoC."""
    return PayoutService(db).run_weekly_friday(force=force, dry_run=dry_run)
