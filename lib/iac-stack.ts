import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { ProviderAttribute, StringAttribute, UserPool, UserPoolClientIdentityProvider, UserPoolIdentityProviderFacebook, UserPoolIdentityProviderGoogle } from 'aws-cdk-lib/aws-cognito';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class IacStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const pool = new UserPool(this, "UserPool", { 
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

    const domainPrefix = `1clickparish-auth`;
    const domain = pool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix },
    });

    const secretGoogle = Secret.fromSecretNameV2(this, "cognitoGoogleClientSecret", "1clickparish/google").secretValue
    const secretFacebook = Secret.fromSecretNameV2(this, "cognitoFacebookClientSecret", "1clickparish/facebook").secretValue

    const googleProvider = new UserPoolIdentityProviderGoogle(this, 'Google', {
      clientId: 'google-client-id',
      userPool: pool,
      clientSecretValue: secretGoogle,
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        givenName: ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: ProviderAttribute.GOOGLE_NAME
      },
    });

    const facebookProvider = new UserPoolIdentityProviderFacebook(this, 'Facebook', {
      clientId: 'facebook-client-id',
      userPool: pool,
      clientSecret: secretFacebook.toString(),
      attributeMapping: {
        email: ProviderAttribute.FACEBOOK_EMAIL,
        givenName: ProviderAttribute.FACEBOOK_FIRST_NAME,
        familyName: ProviderAttribute.FACEBOOK_LAST_NAME,
        fullname: ProviderAttribute.FACEBOOK_NAME
      },
    });

    const client = pool.addClient('1clickparish-app-client', {
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
    client.node.addDependency(googleProvider,facebookProvider,domain);
  }
}
