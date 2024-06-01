from collections import OrderedDict
import json
import os
from bs4 import BeautifulSoup
from deep_translator import GoogleTranslator


def extract_i18n_keys(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    i18n_dict = {}
    for tag in soup.find_all(attrs={"data-i18n": True}):
        i18n_values = str(tag.attrs.get("data-i18n")).split(";")

        for value in i18n_values:
            if value.startswith('['):
                end_bracket_pos = value.find(']')
                if end_bracket_pos != -1:
                    attribute_name = value[1:end_bracket_pos]
                    key = value[end_bracket_pos+1:]
                    value = tag.attrs.get(attribute_name, '')
                    i18n_dict[key] = value
            else:
                key = value
                value = tag.text.strip()
                i18n_dict[key] = value
    return i18n_dict


def process_html_files(directory):
    i18n_data = {}
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.html'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    html_content = f.read()

                i18n_data.update(extract_i18n_keys(html_content))
    return i18n_data


def update_json(json_file, i18n_dict):
    with open(json_file, 'r', encoding='utf-8') as file:
        data = json.load(file, object_pairs_hook=OrderedDict)

    try:
        for key in i18n_dict.keys():
            if key not in data and i18n_dict[key] != "":
                print(f"Key '{key}' not found in '{json_file}'.")
                data[key] = GoogleTranslator(source='en', target='zh-CN').translate(i18n_dict[key])
    except Exception as e:
        print(f"Error processing '{json_file}': {e}")

    for key in list(data.keys()):
        if key not in i18n_dict:
            print(f"Key '{key}' not found in '{json_file}'.")
            del data[key]

    with open(json_file, 'w', encoding='utf-8', newline='\n') as file:
        json.dump(data, file, ensure_ascii=False, indent=4)
        file.write('\n')

    return data


if __name__ == "__main__":
    directory_path = "public"
    json_file_path = "public/locales/zh-cn.json"

    all_i18n_data = process_html_files(directory_path)

    updated_json = update_json(json_file_path, all_i18n_data)
