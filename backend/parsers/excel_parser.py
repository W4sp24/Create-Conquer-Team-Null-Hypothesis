"""
Excel parser — converts .xlsx/.xls to structured JSON rows.
Uses openpyxl/pandas to parse baseline surveys, beneficiary registers, yield records.
Column headers are interpreted by the Data Analyst agent — no rigid mapping required.
"""

import io
from typing import List

import pandas as pd

from models import ExcelRow


def parse_excel(file_content: bytes) -> List[ExcelRow]:
    """
    Parse Excel file content into structured JSON rows.
    
    Args:
        file_content: Raw bytes of the Excel file
        
    Returns:
        List of ExcelRow objects with flexible column mapping
        
    Raises:
        ValueError: If file cannot be parsed
    """
    try:
        # Read Excel file from bytes
        df = pd.read_excel(io.BytesIO(file_content))
        
        # Convert DataFrame to list of dictionaries
        # Each row becomes a dict with column names as keys
        rows = []
        for _, row in df.iterrows():
            # Convert row to dict, handling NaN values
            row_dict = {}
            for col, value in row.items():
                # Skip NaN values
                if pd.notna(value):
                    # Convert numpy types to Python native types
                    if hasattr(value, 'item'):
                        row_dict[str(col)] = value.item()
                    else:
                        row_dict[str(col)] = value
            
            rows.append(ExcelRow(data=row_dict))
        
        return rows
    
    except Exception as e:
        raise ValueError(f"Failed to parse Excel file: {str(e)}")

# Made with Bob
