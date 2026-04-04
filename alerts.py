RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def _divider(char: str = "=", width: int = 52, color: str = CYAN) -> str:
    return f"{color}{char * width}{RESET}"


def alert_animal_crossing(
    animal_type: str,
    timestamp: str,
    confidence: float,
    image_path: str,
    zone_path: str | None = None,
    camera_id: str = "CAM-01",
) -> None:
    print()
    print(_divider(color=YELLOW))
    print(f"{BOLD}{YELLOW}  ANIMAL CROSSING DETECTED  {RESET}")
    print(_divider("-", color=YELLOW))
    print(f"  {'Type':<14}: {BOLD}Animal Crossing{RESET}")
    print(f"  {'Animal':<14}: {animal_type.capitalize()}")
    print(f"  {'Time':<14}: {timestamp}")
    print(f"  {'Confidence':<14}: {confidence:.2f}")
    print(f"  {'Camera':<14}: {camera_id}")
    if zone_path:
        print(f"  {'Zone Path':<14}: {zone_path}")
    print(f"  {'Image Saved':<14}: {GREEN}{image_path}{RESET}")
    print(f"  {'Database':<14}: {GREEN}Entry created{RESET}")
    print(_divider(color=YELLOW))
    print()


def alert_accident(
    vehicles_count: int,
    timestamp: str,
    confidence: float,
    image_path: str,
    camera_id: str = "CAM-01",
) -> None:
    print()
    print(_divider(color=RED))
    print(f"{BOLD}{RED}  ACCIDENT DETECTED  {RESET}")
    print(_divider("-", color=RED))
    print(f"  {'Type':<14}: {BOLD}Accident{RESET}")
    print(f"  {'Vehicles':<14}: {vehicles_count}")
    print(f"  {'Time':<14}: {timestamp}")
    print(f"  {'Confidence':<14}: {_confidence_label(confidence)} ({confidence:.2f})")
    print(f"  {'Camera':<14}: {camera_id}")
    print(f"  {'Image Saved':<14}: {GREEN}{image_path}{RESET}")
    print(f"  {'Database':<14}: {GREEN}Entry created{RESET}")
    print(_divider(color=RED))
    print()


def alert_system_start() -> None:
    print()
    print(_divider())
    print(f"{BOLD}{CYAN}   VANAM 2.0 | Road Safety Monitor   {RESET}")
    print(f"{CYAN}   Animal crossing and accident detection pipeline{RESET}")
    print(_divider())
    print(f"  {GREEN}System initialized. Press Ctrl+C to stop.{RESET}")
    print()


def alert_system_stop(events_logged: int) -> None:
    print()
    print(_divider())
    print(f"{BOLD}{CYAN}   VANAM 2.0 | Session Summary{RESET}")
    print(_divider("-", color=CYAN))
    print(f"  Total events logged : {events_logged}")
    print(f"  Status              : {GREEN}Shutdown complete{RESET}")
    print(_divider())
    print()


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.85:
        return f"{RED}HIGH{RESET}"
    if confidence >= 0.60:
        return f"{YELLOW}MEDIUM{RESET}"
    return "LOW"
