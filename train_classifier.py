import argparse
from pathlib import Path

from paths import configure_ultralytics_env


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train an Ultralytics animal classifier for VANAM.")
    parser.add_argument(
        "--data",
        default="datasets/animal_classifier",
        help="Prepared dataset root containing train/ and val/ folders",
    )
    parser.add_argument(
        "--model",
        default="yolov8n-cls.pt",
        help="Pretrained Ultralytics classification checkpoint",
    )
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=224, help="Training image size")
    parser.add_argument("--batch", type=int, default=32, help="Batch size")
    parser.add_argument("--device", default=None, help="Device string, for example cpu or 0")
    parser.add_argument("--project", default="runs/classify", help="Training output directory")
    parser.add_argument("--name", default="vanam-animal-cls", help="Run name")
    parser.add_argument("--exist-ok", action="store_true", help="Allow reuse of the output run name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = Path(args.data).resolve()

    if not (data_dir / "train").exists():
        raise FileNotFoundError(f"Missing train directory under {data_dir}")
    if not (data_dir / "val").exists():
        raise FileNotFoundError(f"Missing val directory under {data_dir}")

    print(f"[Train] Dataset: {data_dir}")
    print(f"[Train] Model:   {args.model}")
    print(f"[Train] Epochs:  {args.epochs}")

    configure_ultralytics_env()
    from ultralytics import YOLO

    model = YOLO(args.model)
    model.train(
        data=str(data_dir),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=args.project,
        name=args.name,
        exist_ok=args.exist_ok,
    )

    metrics = model.val(data=str(data_dir), split="val")
    print("[Train] Validation complete.")
    print(metrics)


if __name__ == "__main__":
    main()
