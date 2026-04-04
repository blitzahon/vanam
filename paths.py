import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
EVENTS_DIR = BASE_DIR / "events"
VIDEOS_DIR = BASE_DIR / "videos"
DB_PATH = BASE_DIR / "database.db"
ULTRALYTICS_DIR = BASE_DIR / "Ultralytics"


def ensure_runtime_dirs() -> None:
    EVENTS_DIR.mkdir(exist_ok=True)
    VIDEOS_DIR.mkdir(exist_ok=True)
    ULTRALYTICS_DIR.mkdir(exist_ok=True)


def configure_ultralytics_env() -> None:
    ensure_runtime_dirs()
    os.environ.setdefault("YOLO_CONFIG_DIR", str(ULTRALYTICS_DIR))


def relative_to_base(path: str | Path) -> str:
    path_obj = Path(path).resolve()
    try:
        return path_obj.relative_to(BASE_DIR.resolve()).as_posix()
    except ValueError:
        return path_obj.as_posix()
