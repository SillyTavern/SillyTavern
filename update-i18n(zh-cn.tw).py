# python3.13.5 64-bit
# need opencc-python-reimplemented

import json
import subprocess
from opencc import OpenCC

# OpenCC configurations for Simplified to Traditional and vice versa
cc_s2tw = OpenCC("s2tw")  # Simplified Chinese to Traditional Chinese
cc_tw2s = OpenCC("tw2s")  # Traditional Chinese to Simplified Chinese

data_cn: dict[str, str] = {}
data_tw: dict[str, str] = {}

ReplacementMap = {
    "幺": "么",
    "控制檯": "控制台",
    "主控臺": "主控台",
}


def load_localization_resources():
    """Load the JSON files for Simplified Chinese and Traditional Chinese"""
    global data_cn, data_tw
    with open("./public/locales/zh-cn.json", "r", encoding="utf-8") as file:
        data_cn = json.load(file)

    with open("./public/locales/zh-tw.json", "r", encoding="utf-8") as file:
        data_tw = json.load(file)


def add_missing_keys(f: dict[str, str], t: dict[str, str]):
    _f = f.copy()
    for key, value in t.items():
        if key not in f:
            _f[key] = value
            # print(f"Added key: {key}: {value}")
    return _f


def update_localization_files():
    """save the data to a new file for Simplified to Traditional/Traditional to Simplified"""
    with open("./public/locales/zh-cn.tmp.json", "w", encoding="utf-8") as file:
        print("Updating zh-cn.json with missing keys from zh-tw.json")
        json.dump(
            convert_text(cc_tw2s, add_missing_keys(data_cn, data_tw)),
            file,
            ensure_ascii=False,
            indent=4,
        )

    with open("./public/locales/zh-tw.tmp.json", "w", encoding="utf-8") as file:
        print("Updating zh-tw.json with missing keys from zh-cn.json")
        json.dump(
            convert_text(cc_s2tw, add_missing_keys(data_tw, data_cn)),
            file,
            ensure_ascii=False,
            indent=4,
        )


def convert_text(cc: OpenCC, data: dict[str, str]) -> dict[str, str]:
    for key, value in data.items():
        _v = cc.convert(value)
        for k, v in ReplacementMap.items():
            _v = _v.replace(k, v)
        data[key] = _v
    return data


def run(cmd):
    """Run a shell command and handle errors."""
    try:
        subprocess.run(cmd, shell=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}: {e.cmd}")


def main():
    print("Starting update process for zh-cn and zh-tw locales...")
    load_localization_resources()
    update_localization_files()
    for language_code in ("zh-tw", "zh-cn"):
        run(
            f"code --diff ./public/locales/{language_code}.tmp.json ./public/locales/{language_code}.json"
        )
    input("Update completed. Press Enter to exit.")


main()
