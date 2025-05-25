# generate_plant_barcode/__init__.py
import logging
import azure.functions as func
import json
import os
import base64
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.barcode import code128
from reportlab.graphics import renderPDF
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient
import uuid
import datetime

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Generate Plant Barcode API triggered.')
    
    try:
        # Handle CORS for web requests
        if req.method == 'OPTIONS':
            return func.HttpResponse(
                "",
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, X-Business-ID, X-User-Email"
                }
            )
        
        # Get parameters
        plant_id = req.params.get('plantId')
        business_id = req.params.get('businessId')
        
        if not plant_id or not business_id:
            return func.HttpResponse(
                json.dumps({"error": "Plant ID and Business ID are required"}),
                status_code=400,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Initialize Cosmos client
        connection_string = os.environ.get("COSMOSDB__MARKETPLACE_CONNECTION_STRING")
        database_id = os.environ.get("COSMOSDB_MARKETPLACE_DATABASE_NAME", "GreenerMarketplace")
        container_id = "inventory"
        
        if not connection_string:
            return func.HttpResponse(
                json.dumps({"error": "Database connection not configured"}),
                status_code=500,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Parse connection string properly
        if connection_string.startswith("AccountEndpoint="):
            client = CosmosClient.from_connection_string(connection_string)
        else:
            key = os.environ.get("COSMOSDB_KEY")
            client = CosmosClient(connection_string, key)
        
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Get plant information
        try:
            plant = container.read_item(item=plant_id, partition_key=business_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Plant not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        
        # Generate PDF barcode
        pdf_buffer = generate_plant_barcode_pdf(plant, business_id)
        
        # Upload to Azure Blob Storage (optional)
        blob_url = upload_to_blob_storage(pdf_buffer, plant_id, business_id)
        
        if blob_url:
            return func.HttpResponse(
                json.dumps({
                    "success": True,
                    "pdfUrl": blob_url,
                    "plantId": plant_id,
                    "businessId": business_id
                }),
                status_code=200,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
        else:
            # Return PDF as base64 if blob storage fails
            pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode('utf-8')
            
            return func.HttpResponse(
                json.dumps({
                    "success": True,
                    "pdfData": pdf_base64,
                    "plantId": plant_id,
                    "businessId": business_id
                }),
                status_code=200,
                mimetype="application/json",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                }
            )
    
    except Exception as e:
        logging.error(f"Error generating plant barcode: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            }
        )

def generate_plant_barcode_pdf(plant, business_id):
    """Generate PDF with plant information and barcode"""
    try:
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        
        # Get plant information
        plant_name = plant.get('name') or plant.get('common_name', 'Unknown Plant')
        scientific_name = plant.get('scientificName') or plant.get('scientific_name', '')
        plant_id = plant.get('id', '')
        barcode_data = plant.get('barcode', f"PLT-{plant_id}")
        
        # Create QR code data
        qr_data = {
            "type": "plant",
            "id": plant_id,
            "name": plant_name,
            "scientific_name": scientific_name,
            "businessId": business_id,
            "barcode": barcode_data
        }
        qr_json = json.dumps(qr_data)
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = styles['Title']
        heading_style = styles['Heading2']
        normal_style = styles['Normal']
        
        # Story (content)
        story = []
        
        # Title
        story.append(Paragraph(f"<b>{plant_name}</b>", title_style))
        story.append(Spacer(1, 12))
        
        # Scientific name
        if scientific_name:
            story.append(Paragraph(f"<i>{scientific_name}</i>", heading_style))
            story.append(Spacer(1, 12))
        
        # QR Code
        qr_widget = QrCodeWidget(qr_json)
        qr_drawing = Drawing(200, 200)
        qr_drawing.add(qr_widget)
        story.append(qr_drawing)
        story.append(Spacer(1, 12))
        
        # Plant information table
        plant_info = [
            ['Plant ID:', plant_id],
            ['Barcode:', barcode_data],
            ['Business ID:', business_id[:20] + '...' if len(business_id) > 20 else business_id]
        ]
        
        # Add care information if available
        if plant.get('water_days'):
            plant_info.append(['Water every:', f"{plant['water_days']} days"])
        
        if plant.get('light'):
            plant_info.append(['Light:', plant['light']])
            
        if plant.get('temperature'):
            plant_info.append(['Temperature:', plant['temperature']])
            
        if plant.get('humidity'):
            plant_info.append(['Humidity:', plant['humidity']])
        
        # Create table
        info_table = Table(plant_info, colWidths=[120, 300])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(info_table)
        story.append(Spacer(1, 20))
        
        # Instructions
        story.append(Paragraph("<b>Instructions:</b>", heading_style))
        instructions = [
            "1. Print this barcode and place it next to your plant",
            "2. Scan the QR code to view plant information",
            "3. Use the barcode for watering checklist tracking",
            "4. Customers can scan to see plant details"
        ]
        
        for instruction in instructions:
            story.append(Paragraph(instruction, normal_style))
        
        story.append(Spacer(1, 20))
        
        # Footer
        story.append(Paragraph(
            f"<i>Generated on {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC by Greener Business App</i>",
            normal_style
        ))
        
        # Build PDF
        doc.build(story)
        
        # Return buffer
        buffer.seek(0)
        return buffer
        
    except Exception as e:
        logging.error(f"Error generating PDF: {str(e)}")
        raise

def upload_to_blob_storage(pdf_buffer, plant_id, business_id):
    """Upload PDF to Azure Blob Storage"""
    try:
        # Get connection string
        storage_connection = os.environ.get("STORAGE_ACOUNT_MARKETPLACE_STRING")
        
        if not storage_connection:
            logging.warning("Blob storage connection not configured")
            return None
        
        # Create blob service client
        blob_service_client = BlobServiceClient.from_connection_string(storage_connection)
        
        # Container name
        container_name = "business-barcodes"
        
        # Ensure container exists
        try:
            container_client = blob_service_client.get_container_client(container_name)
            container_client.get_container_properties()
        except Exception:
            # Create container if it doesn't exist
            blob_service_client.create_container(container_name, public_access='blob')
        
        # Blob name
        blob_name = f"{business_id}/{plant_id}/barcode_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        # Upload blob
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=blob_name
        )
        
        pdf_buffer.seek(0)
        blob_client.upload_blob(pdf_buffer.read(), overwrite=True)
        
        # Return blob URL
        return blob_client.url
        
    except Exception as e:
        logging.error(f"Error uploading to blob storage: {str(e)}")
        return None