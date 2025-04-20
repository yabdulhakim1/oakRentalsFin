import csv
from datetime import datetime
import re

def convert_date(date_str):
    # Convert '2024-12-26 05:30 PM' to '2024-12-26'
    try:
        dt = datetime.strptime(date_str.strip('"'), '%Y-%m-%d %I:%M %p')
        return dt.strftime('%Y-%m-%d')
    except:
        return ''

def convert_amount(amount_str):
    # Convert '$123.45' to 123.45
    try:
        return '{:.2f}'.format(float(amount_str.strip('"').replace('$', '').replace(',', '')))
    except:
        return '0.00'

def clean_car_name(car_name):
    # Remove year and any extra information, keeping just the make and model
    # Example: "Mitsubishi Mirage 2019" -> "Mitsubishi Mirage"
    car_name = car_name.strip()
    # Remove year pattern (4 digits)
    car_name = re.sub(r'\s+\d{4}', '', car_name)
    return car_name

# Read from the full data file and write the converted data
with open('turo_full_data.csv', 'r', encoding='utf-8') as infile, \
     open('converted_turo.csv', 'w', newline='', encoding='utf-8') as outfile:
    
    reader = csv.reader(infile)
    writer = csv.writer(outfile)
    
    # Skip the header row in the input file
    next(reader)
    
    # Write header exactly as required by the import functionality
    writer.writerow(['Trip ID', 'Car Name', 'Start Date', 'End Date', 'Trip Earnings', 'Trip Expenses'])
    
    # Process each row
    for row in reader:
        if len(row) >= 42 and row[8] == 'Completed':  # Check if it's a completed trip
            trip_id = row[0].strip()
            car_name = clean_car_name(row[3])
            start_date = convert_date(row[4])
            end_date = convert_date(row[5])
            earnings = convert_amount(row[41])  # Total earnings
            expenses = '0.00'  # Keep consistent decimal format
            
            if start_date and end_date and float(earnings) > 0:
                writer.writerow([trip_id, car_name, start_date, end_date, earnings, expenses])

print('Conversion complete! Check converted_turo.csv for the formatted data.')
print('\nSample of converted data:')
with open('converted_turo.csv', 'r') as f:
    print(f.read()) 