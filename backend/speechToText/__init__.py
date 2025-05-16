# backend/speechToText/__init__.py
import logging
import azure.functions as func
import azure.cognitiveservices.speech as speechsdk
import os
import json
import tempfile
import urllib.request
import traceback
from http_helpers import add_cors_headers, handle_options_request, create_error_response, create_success_response

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('speechToText function triggered.')
    
    # Handle CORS
    if req.method == 'OPTIONS':
        return handle_options_request()
    
    try:
        # Try to parse JSON body
        req_body = req.get_json()
        audio_url = req_body.get('audioUrl')
        language = req_body.get('language', 'en-US')  # Default to English (US)
    except Exception as e:
        logging.warning(f"Failed to parse JSON body: {str(e)}")
        # Fallback to query parameters
        audio_url = req.params.get('audioUrl')
        language = req.params.get('language', 'en-US')

    if not audio_url:
        return create_error_response("Missing 'audioUrl' parameter", 400)

    # Get speech config from environment
    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    speech_region = os.environ.get("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        logging.error("Azure Speech key or region not configured in environment variables")
        return create_error_response("Speech service not properly configured. Please check environment variables for AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.", 500)

    try:
        logging.info(f"Downloading audio from {audio_url}")
        
        # Create a temporary file with the correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            try:
                # Set up request with proper headers for blob storage
                request = urllib.request.Request(
                    audio_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0',
                        'Accept': '*/*'
                    }
                )
                
                with urllib.request.urlopen(request) as response:
                    file_content = response.read()
                    # Write the content to the temporary file
                    tmp_file.write(file_content)
                
                tmp_file_path = tmp_file.name
                
                # Log the file size for debugging
                file_size = os.path.getsize(tmp_file_path)
                logging.info(f"Downloaded audio file size: {file_size} bytes")
                
                if file_size == 0:
                    return create_error_response("Downloaded audio file is empty", 400)
                
            except Exception as download_error:
                logging.error(f"Failed to download audio file: {str(download_error)}")
                logging.error(traceback.format_exc())
                return create_error_response(f"Failed to download audio file: {str(download_error)}", 500)

        try:
            # Configure Azure Speech SDK
            speech_config = speechsdk.SpeechConfig(
                subscription=speech_key,
                region=speech_region
            )
            
            # Set speech recognition language
            speech_config.speech_recognition_language = language
            
            logging.info(f"Processing audio file: {tmp_file_path} with language: {language}")
            
            # Create audio configuration with proper format
            audio_config = speechsdk.audio.AudioConfig(filename=tmp_file_path)
            
            # Create recognizer
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config
            )
            
            # This is a safer approach than using recognize_once_async
            done = False
            result_text = ""

            def recognized_cb(evt):
                nonlocal result_text
                logging.info(f'RECOGNIZED: {evt.result.text}')
                result_text += evt.result.text + " "
                
            def session_stopped_cb(evt):
                nonlocal done
                logging.info('SESSION STOPPED')
                done = True
                
            def canceled_cb(evt):
                nonlocal done
                logging.error(f'CANCELED: {evt.reason}')
                if evt.reason == speechsdk.CancellationReason.Error:
                    logging.error(f'CANCELED: {evt.error_details}')
                done = True

            # Connect callbacks
            recognizer.recognized.connect(recognized_cb)
            recognizer.session_stopped.connect(session_stopped_cb)
            recognizer.canceled.connect(canceled_cb)

            # Start recognition
            recognizer.start_continuous_recognition()
            
            # Wait for completion (with timeout)
            import time
            timeout = 30  # 30 seconds timeout
            start_time = time.time()
            
            while not done and (time.time() - start_time) < timeout:
                time.sleep(0.5)
                
            # Stop recognition
            recognizer.stop_continuous_recognition()
            
            # Clean up temp file
            try:
                os.unlink(tmp_file_path)
                logging.info(f"Temporary file {tmp_file_path} deleted")
            except Exception as delete_error:
                logging.warning(f"Failed to delete temporary file: {str(delete_error)}")

            # Check if we have results
            if result_text:
                logging.info(f"Recognition successful: '{result_text}'")
                return create_success_response({
                    "text": result_text.strip(),
                    "confidence": 1.0  # Azure doesn't provide word-level confidence in basic API
                })
            else:
                # If we got here but have no text, it's likely a timeout or silent audio
                logging.warning("No speech could be recognized")
                return create_error_response({
                    "error": "No speech could be recognized in the audio file",
                    "reason": "NoMatch"
                }, 404)

        except Exception as speech_error:
            logging.error(f"Speech recognition error: {str(speech_error)}")
            logging.error(traceback.format_exc())
            return create_error_response(f"Speech recognition error: {str(speech_error)}", 500)

    except Exception as e:
        logging.error(f"Exception during speech recognition: {str(e)}")
        logging.error(traceback.format_exc())
        return create_error_response(f"Internal server error: {str(e)}", 500)