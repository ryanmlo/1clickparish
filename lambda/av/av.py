DOMAIN_NAME = "1clickparish.com"

def lambda_handler(event, context):
    event['response']['autoConfirmUser'] = False
    if 'hd' not in event['request']['userAttributes']: return event
    if event['request']['userAttributes']['hd'] == DOMAIN_NAME: event['response']['autoConfirmUser'] = True
    return event