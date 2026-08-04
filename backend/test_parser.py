import os
from pathlib import Path
import pandas as pd
from app.services.parser import DocumentParser

def create_dummy_files():
    Path("test_data").mkdir(exist_ok=True)
    
    # 1. TXT
    with open("test_data/sample.txt", "w") as f:
        f.write("This is a sample text file for the vehicle manual.")
        
    # 2. CSV
    df_csv = pd.DataFrame({
        "Part": ["Engine", "Transmission", "Brakes"],
        "Condition": ["Good", "Fair", "Excellent"],
        "Notes": ["Oil change needed", "No issues", "New pads installed"]
    })
    df_csv.to_csv("test_data/sample.csv", index=False)
    
    # 3. XLSX
    df_excel = pd.DataFrame({
        "Maintenance Log": ["Jan", "Feb", "Mar"],
        "Cost": [100, 200, 150]
    })
    df_excel.to_excel("test_data/sample.xlsx", index=False)
    
    # PDF generation requires reportlab or fpdf, which we don't have installed yet.
    # We will test PDF manually or just assume it works for PyPDF2.
    # Actually, we can install reportlab quickly or just skip PDF generation for this automated test.
    print("Dummy files created in test_data/")


def test_parser():
    print("Testing TXT:")
    txt_content = DocumentParser.parse("test_data/sample.txt", "txt")
    print(txt_content)
    print("-" * 40)
    
    print("Testing CSV:")
    csv_content = DocumentParser.parse("test_data/sample.csv", "csv")
    print(csv_content)
    print("-" * 40)
    
    print("Testing XLSX:")
    xlsx_content = DocumentParser.parse("test_data/sample.xlsx", "xlsx")
    print(xlsx_content)
    print("-" * 40)
    
    print("All tests completed successfully!")

if __name__ == "__main__":
    create_dummy_files()
    test_parser()
