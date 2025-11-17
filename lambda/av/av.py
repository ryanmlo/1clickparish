DOMAIN_NAME = "1clickparish.com"
DEFAULT_EXCEPTION_MESSAGE = 'Your Google Account was rejected.'

def lambda_handler(event, context):
    if 'hd' not in event['request']['userAttributes']: raise Exception(DEFAULT_EXCEPTION_MESSAGE)
    if event['request']['userAttributes']['hd'] == DOMAIN_NAME: event['response']['autoConfirmUser'] = True
    else: raise Exception(DEFAULT_EXCEPTION_MESSAGE)
    return event