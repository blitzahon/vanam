import argparse
import random
import shutil
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare an Ultralytics classification dataset from the provided animal archive."
    )
    parser.add_argument("--zip", required=True, help="Path to the source zip archive")
    parser.add_argument(
        "--output",
        default="datasets/animal_classifier",
        help="Directory where the prepared dataset will be written",
    )
    parser.add_argument(
        "--val-split",
        type=float,
        default=0.2,
        help="Validation split used when the archive only contains a train split",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed used for reproducible train/val splitting",
    )
    parser.add_argument(
        "--limit-per-class",
        type=int,
        default=None,
        help="Optional cap per class for quick smoke tests",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite the output directory if it already exists",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    zip_path = Path(args.zip).expanduser().resolve()
    output_dir = Path(args.output).resolve()

    if not zip_path.exists():
        raise FileNotFoundError(f"Archive not found: {zip_path}")

    if output_dir.exists():
        if not args.force:
            raise FileExistsError(
                f"Output directory already exists: {output_dir}. Use --force to overwrite it."
            )
        shutil.rmtree(output_dir)

    rng = random.Random(args.seed)
    records = scan_archive(zip_path)
    write_dataset(records, zip_path, output_dir, args.val_split, rng, args.limit_per_class)
    print_summary(output_dir)


def scan_archive(zip_path: Path) -> dict[str, dict[str, list[str]]]:
    splits: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

    with ZipFile(zip_path) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue

            member_path = Path(member.filename)
            if len(member_path.parts) < 4:
                continue
            if member_path.parts[0] != "animals":
                continue
            if member_path.parts[1] not in {"train", "val", "valid", "test"}:
                continue
            if member_path.suffix.lower() not in IMAGE_SUFFIXES:
                continue

            split_name = "val" if member_path.parts[1] == "valid" else member_path.parts[1]
            class_name = member_path.parts[2].lower()
            splits[split_name][class_name].append(member.filename)

    if not splits:
        raise ValueError("No supported image dataset structure was found in the archive.")

    return splits


def write_dataset(
    records: dict[str, dict[str, list[str]]],
    zip_path: Path,
    output_dir: Path,
    val_split: float,
    rng: random.Random,
    limit_per_class: int | None,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    with ZipFile(zip_path) as archive:
        if "val" in records or "test" in records:
            for split_name, class_map in records.items():
                for class_name, members in class_map.items():
                    members = sorted(members)
                    if limit_per_class is not None:
                        members = members[:limit_per_class]
                    extract_members(archive, members, output_dir / split_name / class_name)
        else:
            train_split = records.get("train", {})
            for class_name, members in train_split.items():
                members = sorted(members)
                if limit_per_class is not None:
                    members = members[:limit_per_class]

                rng.shuffle(members)
                val_count = max(1, int(len(members) * val_split)) if len(members) > 1 else 0
                val_members = members[:val_count]
                train_members = members[val_count:]

                if not train_members and val_members:
                    train_members = val_members[:1]
                    val_members = val_members[1:]

                extract_members(archive, train_members, output_dir / "train" / class_name)
                if val_members:
                    extract_members(archive, val_members, output_dir / "val" / class_name)


def extract_members(archive: ZipFile, members: list[str], destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for member in members:
        target_path = destination / Path(member).name
        with archive.open(member) as source, target_path.open("wb") as target:
            shutil.copyfileobj(source, target)


def print_summary(output_dir: Path) -> None:
    print(f"[Dataset] Prepared dataset at {output_dir}")
    for split_dir in sorted(path for path in output_dir.iterdir() if path.is_dir()):
        class_counts = []
        total = 0
        for class_dir in sorted(path for path in split_dir.iterdir() if path.is_dir()):
            count = sum(1 for file in class_dir.iterdir() if file.is_file())
            class_counts.append(f"{class_dir.name}={count}")
            total += count
        print(f"[Dataset] {split_dir.name}: {total} images ({', '.join(class_counts)})")


if __name__ == "__main__":
    main()
