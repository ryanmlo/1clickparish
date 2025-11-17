import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { ProviderAttribute, StringAttribute, UserPool, UserPoolClientIdentityProvider, UserPoolIdentityProviderFacebook, UserPoolIdentityProviderGoogle } from 'aws-cdk-lib/aws-cognito';
import { Runtime, Function, Code } from 'aws-cdk-lib/aws-lambda';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class IacStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const pool1 = new UserPool(this, "Pool1", { 
      signInCaseSensitive: false,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: false,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'websiteId': new StringAttribute( { minLen: 4, maxLen: 30, mutable: true } )
      }
    });

    const preSignUp = new Function(this, 'PreSignUp', {
      runtime: Runtime.NODEJS_LATEST,
      handler: 'index.handler',
      code: Code.fromAsset("lambda/av"),
    });

    const pool2 = new UserPool(this, "Pool2", { 
      signInCaseSensitive: false,
      lambdaTriggers: {
        preSignUp: preSignUp
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: false,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        'websiteId': new StringAttribute( { minLen: 4, maxLen: 30, mutable: true } ),
      }
    });

    const domainPrefix = `1clickparish-auth`;
    const domain = pool1.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });

    const googleClientSecret1 = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret1", "1clickparish/bullfrog").secretValue

    const googleProvider1 = new UserPoolIdentityProviderGoogle(this, 'Google1', {
      clientId: 'google-client-id',
      userPool: pool1,
      clientSecretValue: googleClientSecret1,
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: ProviderAttribute.GOOGLE_NAME
      },
      scopes: ['profile', 'email', 'openid']
    });

    const googleClientSecret2 = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret2", "1clickparish/toadcow").secretValue

    const googleProvider2 = new UserPoolIdentityProviderGoogle(this, 'Google2', {
      clientId: 'google-client-id',
      userPool: pool2,
      clientSecretValue: googleClientSecret2,
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: ProviderAttribute.GOOGLE_NAME
      },
      scopes: ['profile', 'email', 'openid']
    });

    const facebookClientSecret = '{{resolve:secretsmanager:1clickparish/calftadpole:SecretString:clientSecret}}';

    const facebookProvider = new UserPoolIdentityProviderFacebook(this, 'Facebook', {
      clientId: 'facebook-client-id',
      userPool: pool1,
      clientSecret: facebookClientSecret,
      attributeMapping: {
        email: ProviderAttribute.FACEBOOK_EMAIL,
        givenName: ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: ProviderAttribute.FACEBOOK_LAST_NAME,
        fullname: ProviderAttribute.FACEBOOK_NAME
      },
      scopes: ['profile', 'email', 'openid']
    });

    const client = pool1.addClient('1clickparish-app-client', {
      authFlows: {
        userPassword: true,
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.GOOGLE,
        UserPoolClientIdentityProvider.FACEBOOK,
        UserPoolClientIdentityProvider.COGNITO,
      ],
      authSessionValidity: Duration.minutes(15),
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
    });
    client.node.addDependency(googleProvider1,googleProvider2,facebookProvider,domain);
  }
}
